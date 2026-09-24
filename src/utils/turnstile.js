import axios from 'axios'

const verificationUrl = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

const expectedHostnames = () => (process.env.TURNSTILE_EXPECTED_HOSTNAMES || '')
  .split(',')
  .map((hostname) => hostname.trim().toLowerCase())
  .filter(Boolean)

/**
 * Verifies a Turnstile token on the server. A token is single-use and never
 * constitutes proof of completion until Cloudflare validates it here.
 */
export const verifyTurnstile = async (token, remoteIp) => {
  if (!process.env.TURNSTILE_SECRET_KEY) {
    return { success: false, configurationError: true }
  }

  if (!token || typeof token !== 'string') {
    return { success: false, error: 'Please complete the security check.' }
  }

  try {
    const payload = new URLSearchParams({
      secret: process.env.TURNSTILE_SECRET_KEY,
      response: token,
    })
    if (remoteIp) payload.append('remoteip', remoteIp)

    const response = await axios.post(verificationUrl, payload.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 8000,
    })
    const result = response.data || {}
    const allowedHostnames = expectedHostnames()
    const hostname = String(result.hostname || '').toLowerCase()
    const hostnameMatches = !allowedHostnames.length || allowedHostnames.includes(hostname)

    if (!result.success || !hostnameMatches) {
      return { success: false, error: 'The security check could not be verified. Please try again.' }
    }

    return { success: true }
  } catch (error) {
    console.error('[contact] Turnstile verification failed:', error.message)
    return { success: false, error: 'The security check is temporarily unavailable. Please try again shortly.' }
  }
}
