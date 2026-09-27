import assert from 'node:assert/strict'

process.env.READINESS_INSIGHT_AI_ENABLED = 'true'
process.env.ANTHROPIC_API_KEY = 'test-key-not-a-secret'
process.env.ANTHROPIC_API_BASE = 'https://claude.example.test'
process.env.READINESS_INSIGHT_AI_MODEL = 'claude-haiku-4-5'
process.env.READINESS_INSIGHT_DAILY_LIMIT = '10'

const originalFetch = global.fetch
let request

global.fetch = async (url, options) => {
  request = { url, options }
  return new Response(JSON.stringify({
    content: [{
      type: 'text',
      text: JSON.stringify({
        headline: 'Make the current grant position easier to see before urgency takes over.',
        paragraphs: [
          'The responses indicate that visibility and acquittal readiness are not yet equally dependable across the portfolio. That may mean the team needs to assemble key dates, requirements and current evidence from more than one source before it can agree what needs attention.',
          'When this information is fragmented, an ordinary reporting request can create additional coordination work. The issue is less about individual effort and more about whether the team has one current view that connects a commitment to its owner, next action and supporting record.',
          'Begin with the three nearest material commitments. Bring their dates, accountable owners, next actions and missing evidence into one shared review, then agree the one action that will remove the biggest uncertainty before the next checkpoint.',
        ],
        discussionPrompt: 'For the next three material commitments, which owner can confirm the next action and the evidence still needed without a separate search?',
      }),
    }],
  }), { status: 200, headers: { 'content-type': 'application/json' } })
}

try {
  const {
    createReadinessInsight,
    normaliseReadinessAnswers,
    readinessQuestionIds,
  } = await import('../src/utils/portfolioReadinessInsights.js')
  const answers = normaliseReadinessAnswers(readinessQuestionIds.map((id, index) => ({ id, score: index % 4 })))
  const insight = await createReadinessInsight(answers)

  assert.equal(request.url, 'https://claude.example.test/v1/messages')
  assert.equal(request.options.headers['x-api-key'], 'test-key-not-a-secret')
  assert.equal(request.options.headers['anthropic-version'], '2023-06-01')
  assert.equal(JSON.parse(request.options.body).model, 'claude-haiku-4-5')
  assert.equal(insight.source, 'ai')
  assert.equal(insight.paragraphs.length, 3)
  assert.match(insight.discussionPrompt, /next three material commitments/i)
  console.log('Portfolio readiness Claude provider smoke tests passed.')
} finally {
  global.fetch = originalFetch
}
