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
import { getSystemSetting as getSetting, setSystemSetting } from '../utils/systemSettings.js'
import { createTransporter, isMailConfigured, resolveMailConfig } from '../utils/mailHelper.js'

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

  await setSystemSetting('aws_ses_region', aws_ses_region, { group: 'email' })
  await setSystemSetting('aws_access_key_id', aws_access_key_id, { group: 'email' })
  await setSystemSetting('from_email', from_email, { group: 'email' })
  await setSystemSetting('from_name', from_name || 'GrantMaestro', { group: 'email' })

  // Only update the secret key if a new value was provided
  if (aws_secret_access_key && aws_secret_access_key.trim() !== '') {
    await setSystemSetting('aws_secret_access_key', aws_secret_access_key, { group: 'email', encrypted: true })
  }

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

  // Same configuration and transport as every other outgoing email.
  const config = await resolveMailConfig()
  if (!isMailConfigured(config)) {
    return res.status(400).json({
      success: false,
      message: 'Email settings are not fully configured. Please save your AWS SES credentials first.',
    })
  }

  try {
    const transporter = createTransporter(config)
    await transporter.sendMail({
      from: `"${config.fromName}" <${config.fromEmail}>`,
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
