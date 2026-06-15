import nodemailer from 'nodemailer'
import { SESClient, SendRawEmailCommand } from '@aws-sdk/client-ses'
import Email from 'email-templates'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

const logoBase64 = fs.readFileSync('src/emails/logo.png', 'base64')
export const logoUrl = `data:image/png;base64,${logoBase64}`

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/**
 * Creates a Nodemailer transporter using Amazon SES via the AWS SDK v3.
 * Required environment variables:
 *   AWS_SES_REGION   - e.g. ap-southeast-2
 *   AWS_ACCESS_KEY_ID
 *   AWS_SECRET_ACCESS_KEY
 *   FROM_EMAIL       - verified SES sender address
 */
function createTransporter() {
  const sesClient = new SESClient({
    region: process.env.AWS_SES_REGION || 'ap-southeast-2',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  })

  return nodemailer.createTransport({
    SES: { ses: sesClient, aws: { SendRawEmailCommand } },
  })
}

/**
 * Sends a templated email via Amazon SES.
 *
 * @param {string}   to           - Recipient email address
 * @param {string}   subject      - Email subject line
 * @param {string}   templateName - Pug template name (matches filename in /emails)
 * @param {Object}   templateData - Dynamic data passed to the template
 * @param {Object}   attachment   - Optional Nodemailer attachment object
 */
async function sendEmail(to, subject, templateName, templateData, attachment) {
  try {
    const transporter = createTransporter()

    const email = new Email({
      message: { from: process.env.FROM_EMAIL },
      transport: transporter,
      send: true,
      preview: false,
      views: { root: path.resolve(__dirname, '../emails') },
      juiceResources: { preserveImportant: true },
      juice: true,
    })

    const renderedEmail = await email.render(templateName, {
      ...templateData,
      logoUrl,
    })

    await email.send({
      template: templateName,
      message: {
        to: to,
        subject: subject,
        html: renderedEmail,
        attachments: attachment ? [attachment] : [],
      },
      locals: templateData,
    })

    console.log(`Email sent successfully to ${to}`)
  } catch (error) {
    console.error('Error sending email:', error)
  }
}

export default sendEmail
