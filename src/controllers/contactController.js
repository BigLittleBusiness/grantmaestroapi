import asyncHandler from '../middlewares/async.js'
import sendEmail from '../utils/mailHelper.js'
import { getContactRecipient } from '../utils/contactRecipient.js'
import { verifyTurnstile } from '../utils/turnstile.js'

const enquiryTypes = {
  sales: 'Sales enquiry',
  demo: 'Demo request',
  partnership: 'Partnership enquiry',
  support: 'Support enquiry',
  privacy: 'Privacy enquiry',
  general: 'General enquiry',
}

const sanitiseText = (value, maxLength) => String(value || '')
  .replace(/[\r\n]+/g, ' ')
  .trim()
  .slice(0, maxLength)

const validEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)

export const getContactFormConfiguration = (req, res) => {
  const configured = Boolean(
    process.env.TURNSTILE_SITE_KEY
    && process.env.TURNSTILE_SECRET_KEY
    && getContactRecipient()
  )

  res.status(200).json({
    status: true,
    data: {
      turnstileSiteKey: configured ? process.env.TURNSTILE_SITE_KEY : '',
    },
  })
}

export const submitContactEnquiry = asyncHandler(async (req, res) => {
  const recipient = getContactRecipient()
  if (!recipient || !process.env.TURNSTILE_SITE_KEY || !process.env.TURNSTILE_SECRET_KEY) {
    return res.status(503).json({
      status: false,
      message: 'The contact form is temporarily unavailable. Please try again later.',
    })
  }

  const name = sanitiseText(req.body.name, 120)
  const organisation = sanitiseText(req.body.organisation, 160)
  const email = sanitiseText(req.body.email, 254).toLowerCase()
  const phone = sanitiseText(req.body.phone, 40)
  const enquiryType = sanitiseText(req.body.enquiryType, 40)
  const message = String(req.body.message || '').trim().slice(0, 5000)
  const sourceUrl = sanitiseText(req.body.sourceUrl, 1000)
  const website = sanitiseText(req.body.website, 255)

  // Quietly acknowledge bot submissions that fill the hidden honeypot.
  if (website) {
    return res.status(200).json({ status: true, message: 'Thank you for your enquiry.' })
  }

  if (!name || !validEmail(email) || !message || !enquiryTypes[enquiryType]) {
    return res.status(422).json({
      status: false,
      message: 'Please provide your name, a valid email address, enquiry type and message.',
    })
  }

  const captcha = await verifyTurnstile(req.body.captchaToken, req.ip)
  if (captcha.configurationError) {
    return res.status(503).json({
      status: false,
      message: 'The contact form is temporarily unavailable. Please try again later.',
    })
  }
  if (!captcha.success) {
    return res.status(422).json({
      status: false,
      message: captcha.error,
    })
  }

  const delivery = await sendEmail(
    recipient,
    `GrantMaestro - ${enquiryTypes[enquiryType]}`,
    'contactEnquiry',
    {
      enquiryType: enquiryTypes[enquiryType],
      name,
      organisation: organisation || 'Not supplied',
      email,
      phone: phone || 'Not supplied',
      message,
      sourceUrl: sourceUrl || 'Not supplied',
      receivedAt: new Date().toLocaleString('en-AU', { timeZone: 'Australia/Sydney' }),
      year: new Date().getFullYear(),
    },
    null,
    { replyTo: email }
  )

  if (!delivery.delivered) {
    return res.status(503).json({
      status: false,
      message: 'Your enquiry could not be sent right now. Please try again shortly.',
    })
  }

  return res.status(201).json({
    status: true,
    message: 'Thank you for your enquiry.',
  })
})
