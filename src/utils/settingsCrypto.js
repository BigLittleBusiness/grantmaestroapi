import crypto from 'crypto'

const ALGORITHM = 'aes-256-cbc'

const getKeyMaterial = () => {
  const key = process.env.SETTINGS_ENCRYPTION_KEY
  const iv = process.env.SETTINGS_ENCRYPTION_IV

  if (!key || Buffer.byteLength(key, 'utf8') !== 32) {
    throw new Error('SETTINGS_ENCRYPTION_KEY must be configured as an exact 32-byte value.')
  }
  if (!iv || Buffer.byteLength(iv, 'utf8') !== 16) {
    throw new Error('SETTINGS_ENCRYPTION_IV must be configured as an exact 16-byte value.')
  }

  return { key, iv }
}

export const encryptSetting = (value) => {
  const { key, iv } = getKeyMaterial()
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  return cipher.update(String(value), 'utf8', 'hex') + cipher.final('hex')
}

export const decryptSetting = (value) => {
  const { key, iv } = getKeyMaterial()
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
  return decipher.update(value, 'hex', 'utf8') + decipher.final('utf8')
}

export const hasSettingsEncryption = () => {
  try {
    getKeyMaterial()
    return true
  } catch (_error) {
    return false
  }
}
