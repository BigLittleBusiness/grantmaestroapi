import base from '../models/base.js'
import { decryptSetting, encryptSetting } from './settingsCrypto.js'

const { SystemSettings } = base

/**
 * Key/value platform settings (grant_system_settings). Secrets are stored
 * AES-encrypted: pass `encrypted: true` when saving and they are decrypted
 * transparently when read.
 */
export const getSystemSetting = async (key) => {
  const row = await SystemSettings.findOne({
    where: { setting_key: key, is_deleted: 0 },
  })
  if (!row) return null
  return row.is_encrypted ? decryptSetting(row.setting_value) : row.setting_value
}

export const setSystemSetting = async (key, value, {
  group = 'platform',
  encrypted = false,
} = {}) => {
  const existing = await SystemSettings.findOne({
    where: { setting_key: key, is_deleted: 0 },
  })
  const now = new Date()
  const payload = {
    setting_value: encrypted ? encryptSetting(value) : value,
    setting_group: group,
    is_encrypted: encrypted ? 1 : 0,
    modified_at: now,
  }
  if (existing) {
    await existing.update(payload)
    return existing
  }
  return SystemSettings.create({
    setting_key: key,
    is_blocked: 0,
    is_deleted: 0,
    created_at: now,
    ...payload,
  })
}

export const getStripeConfiguration = async () => {
  const [secretKey, publishableKey, currency, enabled, webhookSecret] = await Promise.all([
    getSystemSetting('stripe_secret_key'),
    getSystemSetting('stripe_publishable_key'),
    getSystemSetting('stripe_currency'),
    getSystemSetting('stripe_enabled'),
    getSystemSetting('stripe_webhook_secret'),
  ])
  return {
    secretKey: secretKey || '',
    publishableKey: publishableKey || '',
    currency: (currency || 'AUD').toLowerCase(),
    enabled: enabled === 'true' || enabled === true || enabled === '1' || enabled === 1,
    webhookSecret: webhookSecret || '',
  }
}

/** 'stripe' when enabled, else 'pin' when Pin Payments is configured, else 'none'. */
export const getActivePaymentProvider = async () => {
  const stripe = await getStripeConfiguration()
  if (stripe.enabled && stripe.secretKey) return 'stripe'
  return await getSystemSetting('pin_secret_key') ? 'pin' : 'none'
}
