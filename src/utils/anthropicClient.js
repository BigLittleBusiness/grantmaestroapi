const trimEnvironmentValue = (value) => String(value || '').trim()

export const isClaudeConfigured = () => Boolean(trimEnvironmentValue(process.env.ANTHROPIC_API_KEY))

const readConfiguration = ({ model, timeout }) => ({
  apiKey: trimEnvironmentValue(process.env.ANTHROPIC_API_KEY),
  baseURL: trimEnvironmentValue(process.env.ANTHROPIC_API_BASE || 'https://api.anthropic.com').replace(/\/$/, ''),
  model: trimEnvironmentValue(model || process.env.CLAUDE_MODEL || 'claude-haiku-4-5'),
  timeout: Number.isInteger(timeout) ? timeout : 8000,
})

/**
 * Sends a server-side request to Anthropic's Messages API. This module never
 * exposes a credential to the browser and deliberately does not log prompts,
 * completion content or credentials.
 */
export const callClaudeText = async ({
  systemPrompt,
  userPrompt,
  model,
  maxTokens = 512,
  temperature = 0.4,
  timeout = 8000,
}) => {
  const configuration = readConfiguration({ model, timeout })
  if (!configuration.apiKey) throw new Error('ANTHROPIC_API_KEY is not configured on this server.')

  const abortController = new AbortController()
  const timeoutId = setTimeout(() => abortController.abort(), configuration.timeout)

  try {
    const response = await fetch(`${configuration.baseURL}/v1/messages`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': configuration.apiKey,
        'anthropic-version': '2023-06-01',
      },
      signal: abortController.signal,
      body: JSON.stringify({
        model: configuration.model,
        max_tokens: maxTokens,
        temperature,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    })

    if (!response.ok) throw new Error(`Claude request failed with ${response.status}`)
    const body = await response.json()
    const text = body?.content?.find((block) => block?.type === 'text')?.text?.trim()
    if (!text) throw new Error('Claude returned no text content.')
    return text
  } finally {
    clearTimeout(timeoutId)
  }
}
