/**
 * stripeSettingsController.js
 *
 * Handles Stripe credentials storage and connection testing for the
 * Super Admin dashboard. Credentials are stored in grant_system_settings
 * using the same AES-256-CBC encryption already used for Pin Payments.
 *
 * Routes:
 *   GET  /v1/admin/stripe-settings/fetch
 *   POST /v1/admin/stripe-settings/save
 *   GET  /v1/admin/stripe-settings/test-connection
 */
import asyncHandler from '../middlewares/async.js'
import axios from 'axios'
import crypto from 'crypto'
import base from '../models/base.js'
const { SystemSettings } = base

// ─── Encryption helpers (same key/IV as pinPaymentController) ────────────────
const ALGORITHM = 'aes-256-cbc'
const ENC_KEY = process.env.SETTINGS_ENCRYPTION_KEY || 'g6ZOpvHQ78X4PbLzmU5eErPRtdh6mAXp'
const ENC_IV  = process.env.SETTINGS_ENCRYPTION_IV  || 'o6SG75PDEbNTBYJV'

const encryptValue = (text) => {
  const cipher = crypto.createCipheriv(ALGORITHM, ENC_KEY, ENC_IV)
  let enc = cipher.update(text, 'utf8', 'hex')
  enc += cipher.final('hex')
  return enc
}

const decryptValue = (text) => {
  const decipher = crypto.createDecipheriv(ALGORITHM, ENC_KEY, ENC_IV)
  let dec = decipher.update(text, 'hex', 'utf8')
  dec += decipher.final('utf8')
  return dec
}

const upsertSetting = async (key, value, isEncrypted = false) => {
  const existing = await SystemSettings.findOne({ where: { setting_key: key, is_deleted: 0 } })
  const storedValue = isEncrypted ? encryptValue(value) : value
  if (existing) {
    await existing.update({ setting_value: storedValue, is_encrypted: isEncrypted ? 1 : 0 })
  } else {
    await SystemSettings.create({ setting_key: key, setting_value: storedValue, is_encrypted: isEncrypted ? 1 : 0, is_deleted: 0 })
  }
}

const getSetting = async (key) => {
  const row = await SystemSettings.findOne({ where: { setting_key: key, is_deleted: 0 } })
  if (!row) return null
  return row.is_encrypted ? decryptValue(row.setting_value) : row.setting_value
}

// ─── GET /v1/admin/stripe-settings/fetch ────────────────────────────────────
export const fetchStripeSettings = asyncHandler(async (req, res) => {
  const [publishableKey, environment, currency, hasSecret, hasWebhookSecret] = await Promise.all([
    getSetting('stripe_publishable_key'),
    getSetting('stripe_environment'),
    getSetting('stripe_currency'),
    getSetting('stripe_secret_key'),
    getSetting('stripe_webhook_secret'),
  ])

  res.status(200).json({
    success: true,
    data: {
      stripe_publishable_key: publishableKey || '',
      stripe_environment:     environment    || 'test',
      stripe_currency:        currency       || 'AUD',
      // Never return actual secret values to the browser — just indicate presence
      stripe_secret_key:      hasSecret        ? '••••••••' : '',
      stripe_webhook_secret:  hasWebhookSecret ? '••••••••' : '',
    },
  })
})

// ─── POST /v1/admin/stripe-settings/save ────────────────────────────────────
export const saveStripeSettings = asyncHandler(async (req, res) => {
  const {
    stripe_publishable_key,
    stripe_secret_key,
    stripe_environment,
    stripe_currency,
    stripe_webhook_secret,
  } = req.body

  if (stripe_publishable_key !== undefined)
    await upsertSetting('stripe_publishable_key', stripe_publishable_key, false)
  if (stripe_environment !== undefined)
    await upsertSetting('stripe_environment', stripe_environment, false)
  if (stripe_currency !== undefined)
    await upsertSetting('stripe_currency', stripe_currency, false)
  if (stripe_secret_key && !stripe_secret_key.startsWith('•'))
    await upsertSetting('stripe_secret_key', stripe_secret_key, true)
  if (stripe_webhook_secret && !stripe_webhook_secret.startsWith('•'))
    await upsertSetting('stripe_webhook_secret', stripe_webhook_secret, true)

  res.status(200).json({ success: true, message: 'Stripe settings saved successfully.' })
})

// ─── GET /v1/admin/stripe-settings/test-connection ──────────────────────────
export const testStripeConnection = asyncHandler(async (req, res) => {
  const secretKey = await getSetting('stripe_secret_key')
  if (!secretKey) {
    return res.status(400).json({ success: false, message: 'No Stripe secret key configured. Please save your credentials first.' })
  }

  try {
    // Call the Stripe balance endpoint — a lightweight authenticated request
    const response = await axios.get('https://api.stripe.com/v1/balance', {
      headers: {
        Authorization: `Bearer ${secretKey}`,
      },
      timeout: 8000,
    })

    if (response.status === 200) {
      return res.status(200).json({
        success: true,
        message: 'Stripe connection successful.',
        data: { object: response.data?.object },
      })
    }

    return res.status(400).json({ success: false, message: 'Unexpected response from Stripe.' })
  } catch (err) {
    const stripeMsg = err.response?.data?.error?.message || err.message || 'Connection to Stripe failed.'
    return res.status(400).json({ success: false, message: stripeMsg })
  }
})
