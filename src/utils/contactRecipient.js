const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Contact recipients are held only in the protected environment, encoded to
 * avoid storing a scrapeable address in source or client-delivered bundles.
 * Encoding is not encryption; server and repository access controls remain the
 * security boundary.
 */
export const getContactRecipient = () => {
  const encodedRecipient = process.env.CONTACT_RECIPIENT_B64
  if (!encodedRecipient) return ''

  try {
    const recipient = Buffer.from(encodedRecipient, 'base64').toString('utf8').trim()
    return emailPattern.test(recipient) ? recipient : ''
  } catch {
    return ''
  }
}
