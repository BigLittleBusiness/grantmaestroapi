import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const controller = await readFile(new URL('../src/controllers/aiController.js', import.meta.url), 'utf8')
assert.match(controller, /callClaudeText/)
assert.doesNotMatch(controller, /openai|gpt-/i)

process.env.ANTHROPIC_API_KEY = 'test-key-not-a-secret'
process.env.ANTHROPIC_API_BASE = 'https://claude.example.test'
const originalFetch = global.fetch
let request

global.fetch = async (url, options) => {
  request = { url, options }
  return new Response(JSON.stringify({ content: [{ type: 'text', text: 'A concise test grant task description.' }] }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

try {
  const { callClaudeText } = await import('../src/utils/anthropicClient.js')
  const text = await callClaudeText({
    systemPrompt: 'Return concise drafting.',
    userPrompt: 'Draft one sentence.',
    model: 'claude-haiku-4-5',
  })
  assert.equal(text, 'A concise test grant task description.')
  assert.equal(request.url, 'https://claude.example.test/v1/messages')
  assert.equal(request.options.headers['anthropic-version'], '2023-06-01')
  assert.equal(JSON.parse(request.options.body).model, 'claude-haiku-4-5')
  console.log('Claude drafting client smoke tests passed.')
} finally {
  global.fetch = originalFetch
}
