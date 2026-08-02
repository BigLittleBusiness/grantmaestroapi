/**
 * emailSettingsController.js
 *
 * Handles Sys Admin management of AWS SES email configuration.
 * Settings are stored in grant_system_settings, with the secret key encrypted.
 *
 * Routes:
 *   GET  /v1/admin/email-settings/fetch   – retrieve current settings
 *   POST /v1/admin/email-settings/save    – upsert settings
 *   POST /v1/admin/email-settings/test    – send a test email
 */
import asyncHandler from '../middlewares/async.js'
import crypto from 'crypto'
import nodemailer from 'nodemailer'
import { SESClient, SendRawEmailCommand } from '@aws-sdk/client-ses'
import base from '../models/base.js'
const { SystemSettings } = base

// ── Encryption (same key/IV as pinPaymentController) ─────────────────────────
const ALGORITHM = 'aes-256-cbc'
const ENC_KEY = process.env.SETTINGS_ENCRYPTION_KEY || 'g6ZOpvHQ78X4PbLzmU5eErPRtdh6mAXp'
const ENC_IV  = process.env.SETTINGS_ENCRYPTION_IV  || 'o6SG75PDEbNTBYJV'

const encrypt = (text) => {
  const cipher = crypto.createCipheriv(ALGORITHM, ENC_KEY, ENC_IV)
  return cipher.update(text, 'utf8', 'hex') + cipher.final('hex')
}
const decrypt = (text) => {
  const decipher = crypto.createDecipheriv(ALGORITHM, ENC_KEY, ENC_IV)
  return decipher.update(text, 'hex', 'utf8') + decipher.final('utf8')
}

// ── Internal helper ───────────────────────────────────────────────────────────
const upsertSetting = async (key, value, group = 'email', isEncrypted = false) => {
  const existing = await SystemSettings.findOne({ where: { setting_key: key, is_deleted: 0 } })
  const now = new Date()
  if (existing) {
    await existing.update({ setting_value: value, is_encrypted: isEncrypted ? 1 : 0, modified_at: now })
  } else {
    await SystemSettings.create({
      setting_key: key,
      setting_value: value,
      setting_group: group,
      is_encrypted: isEncrypted ? 1 : 0,
      is_blocked: 0,
      is_deleted: 0,
      created_at: now,
      modified_at: now,
    })
  }
}

const getSetting = async (key) => {
  const row = await SystemSettings.findOne({ where: { setting_key: key, is_deleted: 0 } })
  if (!row) return null
  return row.is_encrypted ? decrypt(row.setting_value) : row.setting_value
}

// ── Fetch ─────────────────────────────────────────────────────────────────────
export const fetchEmailSettings = asyncHandler(async (req, res) => {
  const [region, accessKeyId, fromEmail, fromName] = await Promise.all([
    getSetting('aws_ses_region'),
    getSetting('aws_access_key_id'),
    getSetting('from_email'),
    getSetting('from_name'),
  ])

  res.status(200).json({
    success: true,
    data: {
      aws_ses_region:    region      || 'ap-southeast-2',
      aws_access_key_id: accessKeyId || '',
      // Never return the secret key — only indicate if it's saved
      from_email: fromEmail || '',
      from_name:  fromName  || 'GrantMaestro',
    },
  })
})

// ── Save ──────────────────────────────────────────────────────────────────────
export const saveEmailSettings = asyncHandler(async (req, res) => {
  const { aws_ses_region, aws_access_key_id, aws_secret_access_key, from_email, from_name } = req.body

  if (!aws_ses_region || !aws_access_key_id || !from_email) {
    return res.status(400).json({ success: false, message: 'Region, Access Key ID, and From Email are required.' })
  }

  await upsertSetting('aws_ses_region',    aws_ses_region,    'email', false)
  await upsertSetting('aws_access_key_id', aws_access_key_id, 'email', false)
  await upsertSetting('from_email',        from_email,        'email', false)
  await upsertSetting('from_name',         from_name || 'GrantMaestro', 'email', false)

  // Only update the secret key if a new value was provided
  if (aws_secret_access_key && aws_secret_access_key.trim() !== '') {
    await upsertSetting('aws_secret_access_key', encrypt(aws_secret_access_key), 'email', true)
  }

  // Reload env vars so mailHelper picks up new values immediately
  process.env.AWS_SES_REGION           = aws_ses_region
  process.env.AWS_ACCESS_KEY_ID        = aws_access_key_id
  if (aws_secret_access_key && aws_secret_access_key.trim() !== '') {
    process.env.AWS_SECRET_ACCESS_KEY  = aws_secret_access_key
  }
  process.env.FROM_EMAIL = from_email
  process.env.FROM_NAME  = from_name || 'GrantMaestro'

  res.status(200).json({
    success: true,
    message: 'Email settings saved successfully.',
    data: {
      aws_ses_region,
      aws_access_key_id,
      from_email,
      from_name: from_name || 'GrantMaestro',
    },
  })
})

// ── Test ──────────────────────────────────────────────────────────────────────
export const testEmailSettings = asyncHandler(async (req, res) => {
  const { to } = req.body
  if (!to) {
    return res.status(400).json({ success: false, message: 'Recipient email address is required.' })
  }

  // Load current settings from DB (in case env vars not yet set)
  const [region, accessKeyId, secretKey, fromEmail, fromName] = await Promise.all([
    getSetting('aws_ses_region'),
    getSetting('aws_access_key_id'),
    getSetting('aws_secret_access_key'),
    getSetting('from_email'),
    getSetting('from_name'),
  ])

  if (!accessKeyId || !secretKey || !fromEmail) {
    return res.status(400).json({
      success: false,
      message: 'Email settings are not fully configured. Please save your AWS SES credentials first.',
    })
  }

  const decryptedSecret = decrypt(secretKey)

  try {
    const sesClient = new SESClient({
      region: region || 'ap-southeast-2',
      credentials: { accessKeyId, secretAccessKey: decryptedSecret },
    })
    const transporter = nodemailer.createTransport({
      SES: { ses: sesClient, aws: { SendRawEmailCommand } },
    })

    await transporter.sendMail({
      from: `"${fromName || 'GrantMaestro'}" <${fromEmail}>`,
      to,
      subject: 'GrantMaestro — Email Configuration Test',
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;">
          <h2 style="color:#1a3c5e;">Email Settings Test</h2>
          <p>This is a test email from your GrantMaestro platform.</p>
          <p>If you received this, your AWS SES configuration is working correctly.</p>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
          <p style="color:#6b7280;font-size:13px;">Sent from GrantMaestro Sys Admin · ${new Date().toLocaleString('en-AU')}</p>
        </div>
      `,
    })

    res.status(200).json({ success: true, message: 'Test email sent successfully.' })
  } catch (err) {
    console.error('Email test error:', err)
    res.status(500).json({ success: false, message: err.message || 'Failed to send test email.' })
  }
})
