import nodemailer from 'nodemailer'
import { SESClient, SendRawEmailCommand } from '@aws-sdk/client-ses'
import Email from 'email-templates'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'
import base from '../models/base.js'
import { decryptSetting } from './settingsCrypto.js'

const { SystemSettings } = base
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const emailsPath = path.resolve(__dirname, '../emails')
const logoBase64 = fs.readFileSync(path.join(emailsPath, 'logo.png'), 'base64')
export const logoUrl = `data:image/png;base64,${logoBase64}`

const getStoredSetting = async (key) => {
  const row = await SystemSettings.findOne({
    where: { setting_key: key, is_deleted: 0 },
  })
  if (!row) return null
  return row.is_encrypted ? decryptSetting(row.setting_value) : row.setting_value
}

const resolveMailConfig = async () => {
  const [region, accessKeyId, secretAccessKey, fromEmail, fromName] = await Promise.all([
    getStoredSetting('aws_ses_region'),
    getStoredSetting('aws_access_key_id'),
    getStoredSetting('aws_secret_access_key'),
    getStoredSetting('from_email'),
    getStoredSetting('from_name'),
  ])

  return {
    region: region || process.env.AWS_SES_REGION || 'ap-southeast-2',
    accessKeyId: accessKeyId || process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: secretAccessKey || process.env.AWS_SECRET_ACCESS_KEY || '',
    fromEmail: fromEmail || process.env.FROM_EMAIL || '',
    fromName: fromName || process.env.FROM_NAME || 'GrantMaestro',
  }
}

const isMailConfigured = (config) => Boolean(
  config.accessKeyId && config.secretAccessKey && config.fromEmail
)

const createTransporter = (config) => {
  const sesClient = new SESClient({
    region: config.region,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  })
  return nodemailer.createTransport({
    SES: { ses: sesClient, aws: { SendRawEmailCommand } },
  })
}

/**
 * Sends a templated email via AWS SES. Credentials can be supplied through
 * the Sys Admin Email Settings page and remain effective after service restart.
 * When SES is not configured, delivery is skipped without interrupting product
 * workflows; the health check and Sys Admin status show that configuration is required.
 */
async function sendEmail(to, subject, templateName, templateData = {}, attachment, options = {}) {
  try {
    const config = await resolveMailConfig()
    if (!isMailConfigured(config)) {
      console.warn(`[email] Delivery skipped for ${templateName}: AWS SES is not configured.`)
      return { delivered: false, reason: 'SES not configured' }
    }

    const email = new Email({
      message: { from: `"${config.fromName}" <${config.fromEmail}>` },
      transport: createTransporter(config),
      send: true,
      preview: false,
      views: { root: emailsPath },
      juiceResources: { preserveImportant: true },
      juice: true,
    })

    const renderedEmail = await email.render(templateName, {
      ...templateData,
      logoUrl,
    })
    const subjectWithoutLegacyBrand = subject
      .replace(/\s*[—-]\s*Grant\s*Maestro\s*$/i, '')
      .trim()
    const brandedSubject = subjectWithoutLegacyBrand.startsWith('GrantMaestro - ')
      ? subjectWithoutLegacyBrand
      : `GrantMaestro - ${subjectWithoutLegacyBrand}`

    await email.send({
      template: templateName,
      message: {
        to,
        subject: brandedSubject,
        html: renderedEmail,
        replyTo: options.replyTo,
        attachments: attachment ? [attachment] : [],
      },
      locals: templateData,
    })

    console.log(`[email] Sent ${templateName} to ${to}`)
    return { delivered: true }
  } catch (error) {
    console.error(`[email] Delivery failed for ${templateName}:`, error.message)
    return { delivered: false, reason: error.message }
  }
}

export { resolveMailConfig, isMailConfigured }
export default sendEmail
