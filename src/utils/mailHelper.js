import nodemailer from 'nodemailer'
import Email from 'email-templates'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

const logoBase64 = fs.readFileSync('src/emails/logo.png', 'base64')
export const logoUrl = `data:image/png;base64,${logoBase64}`

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

async function createTransporter() {
  return nodemailer.createTransport({
    service: 'Gmail',
    host: 'smtp.gmail.com',
    port: 587,
    tls: {
      ciphers: 'SSLv3',
      rejectUnauthorized: false,
    },
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_PASS,
    },
  })
}

async function sendEmail(to, subject, templateName, templateData, attachment) {
  try {
    const transporter = await createTransporter()

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
        cc: [''],
        bcc: ['avickmukh@gmail.com'],
        html: renderedEmail, // Use the rendered HTML from the template
        attachments: attachment ? [attachment] : [],
      },
      locals: templateData, // Pass dynamic data for template
    })
    console.log(`Email sent successfully to ${to}`)
  } catch (error) {
    console.error('Error sending email:', error)
  }
}

export default sendEmail
