/**
 * pinPaymentController.js
 *
 * Handles all Pin Payments integration for Grant Maestro:
 *   - System Admin CRUD for Pin Payments credentials (stored in grant_system_settings)
 *   - Creating a charge via the Pin Payments REST API
 *   - Webhook signature verification and subscription activation
 *
 * Pin Payments API docs: https://pinpayments.com/developers/api-reference
 *
 * Environment variables required on the server:
 *   SETTINGS_ENCRYPTION_KEY  – 32-char AES-256 key used to encrypt the secret key at rest
 *
 * The publishable key, environment, currency, and webhook secret are stored in plain text.
 * The secret key is AES-256-CBC encrypted before being written to the database.
 */

import asyncHandler from '../middlewares/async.js'
import axios from 'axios'
import crypto from 'crypto'
import base from '../models/base.js'

const { SystemSettings, User, SubscriptionPlans } = base

// ---------------------------------------------------------------------------
// Encryption helpers (reuse the same algorithm already in commonHelper.js)
// ---------------------------------------------------------------------------
const ALGORITHM = 'aes-256-cbc'
const ENC_KEY = process.env.SETTINGS_ENCRYPTION_KEY || 'g6ZOpvHQ78X4PbLzmU5eErPRtdh6mAXp'
const ENC_IV  = process.env.SETTINGS_ENCRYPTION_IV  || 'o6SG75PDEbNTBYJV'

const encryptValue = (text) => {
  const cipher = crypto.createCipheriv(ALGORITHM, ENC_KEY, ENC_IV)
  let encrypted = cipher.update(text, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  return encrypted
}

const decryptValue = (text) => {
  const decipher = crypto.createDecipheriv(ALGORITHM, ENC_KEY, ENC_IV)
  let decrypted = decipher.update(text, 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  return decrypted
}

// ---------------------------------------------------------------------------
// Internal helper – retrieve a single setting value by key
// ---------------------------------------------------------------------------
const getSetting = async (key) => {
  const row = await SystemSettings.findOne({
    where: { setting_key: key, is_deleted: 0 },
  })
  if (!row) return null
  return row.is_encrypted ? decryptValue(row.setting_value) : row.setting_value
}

// ---------------------------------------------------------------------------
// Internal helper – build the Pin Payments base URL from stored environment
// ---------------------------------------------------------------------------
const getPinBaseUrl = async () => {
  const env = await getSetting('pin_environment')
  return env === 'live'
    ? 'https://api.pinpayments.com/1'
    : 'https://test-api.pinpayments.com/1'
}

// ===========================================================================
// SYSTEM ADMIN – Pin Payments Configuration
// ===========================================================================

/**
 * @description  Save (upsert) Pin Payments credentials.
 *               Only Super Admin (user_type = 1) may call this endpoint.
 * @route  POST /v1/admin/pin-settings/save
 * @access Super Admin
 */
export const savePinSettings = asyncHandler(async (req, res) => {
  const {
    pin_publishable_key,
    pin_secret_key,
    pin_environment,
    pin_currency,
    pin_webhook_secret,
  } = req.body

  if (!pin_publishable_key || !pin_secret_key || !pin_environment) {
    return res.status(400).json({
      status: false,
      message: 'pin_publishable_key, pin_secret_key, and pin_environment are required.',
    })
  }

  const upsert = async (key, value, group = 'payment', isEncrypted = false) => {
    const storedValue = isEncrypted ? encryptValue(value) : value
    const existing = await SystemSettings.findOne({ where: { setting_key: key, is_deleted: 0 } })
    if (existing) {
      await existing.update({ setting_value: storedValue, is_encrypted: isEncrypted, modified_at: new Date() })
    } else {
      await SystemSettings.create({
        setting_key: key,
        setting_value: storedValue,
        setting_group: group,
        is_encrypted: isEncrypted,
      })
    }
  }

  await upsert('pin_publishable_key', pin_publishable_key, 'payment', false)
  await upsert('pin_secret_key',      pin_secret_key,      'payment', true)
  await upsert('pin_environment',     pin_environment,     'payment', false)
  await upsert('pin_currency',        pin_currency || 'AUD', 'payment', false)

  if (pin_webhook_secret) {
    await upsert('pin_webhook_secret', pin_webhook_secret, 'payment', true)
  }

  return res.json({
    status: true,
    message: 'Pin Payments settings saved successfully.',
  })
})

/**
 * @description  Retrieve the current Pin Payments configuration.
 *               The secret key is masked; only the publishable key and
 *               non-sensitive fields are returned.
 * @route  GET /v1/admin/pin-settings/fetch
 * @access Super Admin
 */
export const fetchPinSettings = asyncHandler(async (req, res) => {
  const rows = await SystemSettings.findAll({
    where: { setting_group: 'payment', is_deleted: 0 },
    attributes: ['setting_key', 'setting_value', 'is_encrypted'],
  })

  const result = {}
  for (const row of rows) {
    if (row.is_encrypted) {
      // Never expose the raw secret – return a masked placeholder
      result[row.setting_key] = row.setting_value ? '••••••••••••••••' : ''
    } else {
      result[row.setting_key] = row.setting_value
    }
  }

  return res.json({
    status: true,
    message: 'Pin Payments settings retrieved successfully.',
    data: result,
  })
})

/**
 * @description  Test the stored credentials against the Pin Payments API
 *               by fetching the account balance (read-only, no charge created).
 * @route  GET /v1/admin/pin-settings/test-connection
 * @access Super Admin
 */
export const testPinConnection = asyncHandler(async (req, res) => {
  const secretKey = await getSetting('pin_secret_key')
  const baseUrl   = await getPinBaseUrl()

  if (!secretKey) {
    return res.status(400).json({
      status: false,
      message: 'Pin Payments secret key has not been configured yet.',
    })
  }

  try {
    const response = await axios.get(`${baseUrl}/balance`, {
      auth: { username: secretKey, password: '' },
    })
    return res.json({
      status: true,
      message: 'Connection to Pin Payments API successful.',
      data: response.data,
    })
  } catch (err) {
    const pinError = err.response?.data?.error_description || err.message
    return res.status(400).json({
      status: false,
      message: `Pin Payments connection failed: ${pinError}`,
    })
  }
})

// ===========================================================================
// PAYMENT – Create a Charge
// ===========================================================================

/**
 * @description  Tokenise a card and create a one-off charge via Pin Payments.
 *               In production the card token is generated client-side using
 *               the Pin Payments.js library (publishable key) and only the
 *               token is sent to this endpoint – raw card data never touches
 *               the Grant Maestro server.
 *
 * @route  POST /v1/subscription/create-charge
 * @access Authenticated users
 *
 * @body {string} card_token        – Token from Pin Payments.js  (required)
 * @body {number} preferred_plan_id – SubscriptionPlan.plan_id    (required)
 * @body {number} payment_made_for  – User.user_id                (required)
 */
export const createPinCharge = asyncHandler(async (req, res) => {
  const { card_token, preferred_plan_id, payment_made_for } = req.body

  if (!card_token || !preferred_plan_id || !payment_made_for) {
    return res.status(400).json({
      status: false,
      message: 'card_token, preferred_plan_id, and payment_made_for are required.',
    })
  }

  // Load plan
  const plan = await SubscriptionPlans.findOne({
    where: { plan_id: preferred_plan_id, is_deleted: 0 },
  })
  if (!plan) {
    return res.status(404).json({ status: false, message: 'Subscription plan not found.' })
  }

  // Load user
  const user = await User.findOne({ where: { user_id: payment_made_for, is_deleted: 0 } })
  if (!user) {
    return res.status(404).json({ status: false, message: 'User not found.' })
  }

  // Load Pin settings
  const secretKey = await getSetting('pin_secret_key')
  const currency  = (await getSetting('pin_currency')) || 'AUD'
  const baseUrl   = await getPinBaseUrl()

  if (!secretKey) {
    return res.status(500).json({
      status: false,
      message: 'Payment gateway is not configured. Please contact your system administrator.',
    })
  }

  // Amount in cents
  const amountCents = Math.round(plan.plan_price * 100)

  try {
    const chargeResponse = await axios.post(
      `${baseUrl}/charges`,
      {
        email:       user.email,
        description: `Grant Maestro – ${plan.plan_name} (${plan.plan_duration}ly)`,
        amount:      amountCents,
        currency:    currency,
        ip_address:  req.ip || '0.0.0.0',
        card_token:  card_token,
        metadata: {
          user_id:  payment_made_for,
          plan_id:  preferred_plan_id,
          platform: 'grant_maestro',
        },
      },
      {
        auth: { username: secretKey, password: '' },
      }
    )

    const charge = chargeResponse.data.response

    if (charge.success) {
      // Activate the subscription immediately on successful charge
      const expiryDate = new Date()
      if (plan.plan_duration === 'month') expiryDate.setMonth(expiryDate.getMonth() + 1)
      else if (plan.plan_duration === 'year') expiryDate.setFullYear(expiryDate.getFullYear() + 1)
      else if (plan.plan_duration === 'week') expiryDate.setDate(expiryDate.getDate() + 7)
      else expiryDate.setDate(expiryDate.getDate() + 1)

      await User.update(
        {
          subscription_plan_id:       preferred_plan_id,
          subscription_status:        true,
          subscription_is_in_trial:   false,
          subscription_renewal_date:  new Date(),
          subscription_expiry_date:   expiryDate,
          modified_at:                new Date(),
        },
        { where: { user_id: payment_made_for } }
      )

      return res.json({
        status:  true,
        message: 'Payment successful. Your subscription is now active.',
        data: {
          charge_token: charge.token,
          amount:       charge.amount,
          currency:     charge.currency,
          expiry_date:  expiryDate,
        },
      })
    } else {
      return res.status(402).json({
        status:  false,
        message: charge.status_message || 'Payment declined.',
      })
    }
  } catch (err) {
    const pinError = err.response?.data?.error_description || err.message
    return res.status(500).json({
      status: false,
      message: `Payment failed: ${pinError}`,
    })
  }
})

// ===========================================================================
// WEBHOOK – Pin Payments event handler
// ===========================================================================

/**
 * @description  Receives and verifies Pin Payments webhook events.
 *               Pin Payments signs each webhook with an HMAC-SHA256 signature
 *               in the `Pin-Signature` header.
 *
 * @route  POST /v1/subscription/pin-webhook
 * @access Public (no auth – verified by HMAC signature)
 */
export const pinWebhook = asyncHandler(async (req, res) => {
  const signature = req.headers['pin-signature']
  const webhookSecret = await getSetting('pin_webhook_secret')

  // If a webhook secret is configured, verify the signature
  if (webhookSecret && signature) {
    const expectedSig = crypto
      .createHmac('sha256', webhookSecret)
      .update(req.rawBody || JSON.stringify(req.body))
      .digest('hex')

    if (signature !== expectedSig) {
      return res.status(401).json({ status: false, message: 'Invalid webhook signature.' })
    }
  }

  const event = req.body
  const eventType = event?.type

  if (eventType === 'charge.authorised' || eventType === 'charge.captured') {
    const charge  = event.data
    const userId  = charge?.metadata?.user_id
    const planId  = charge?.metadata?.plan_id

    if (userId && planId) {
      const plan = await SubscriptionPlans.findOne({ where: { plan_id: planId, is_deleted: 0 } })
      if (plan) {
        const expiryDate = new Date()
        if (plan.plan_duration === 'month') expiryDate.setMonth(expiryDate.getMonth() + 1)
        else if (plan.plan_duration === 'year') expiryDate.setFullYear(expiryDate.getFullYear() + 1)
        else if (plan.plan_duration === 'week') expiryDate.setDate(expiryDate.getDate() + 7)
        else expiryDate.setDate(expiryDate.getDate() + 1)

        await User.update(
          {
            subscription_plan_id:       planId,
            subscription_status:        true,
            subscription_is_in_trial:   false,
            subscription_renewal_date:  new Date(),
            subscription_expiry_date:   expiryDate,
            modified_at:                new Date(),
          },
          { where: { user_id: userId } }
        )
      }
    }
  }

  if (eventType === 'charge.failed' || eventType === 'charge.declined') {
    const charge = event.data
    const userId = charge?.metadata?.user_id
    if (userId) {
      await User.update(
        { subscription_status: false, modified_at: new Date() },
        { where: { user_id: userId } }
      )
    }
  }

  return res.json({ status: true, message: 'Webhook received.' })
})
