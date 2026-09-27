import assert from 'node:assert/strict'

process.env.MANUS_READINESS_ANALYSIS_ENABLED = 'true'
process.env.MANUS_API_KEY = 'test-key-not-a-secret'
process.env.MANUS_API_BASE = 'https://manus.example.test'
process.env.MANUS_READINESS_AGENT_PROFILE = 'manus-1.6-lite'

const originalFetch = global.fetch
const requests = []
let resultReads = 0
global.fetch = async (url, options = {}) => {
  requests.push({ url, options })
  if (String(url).endsWith('/v2/task.create')) {
    return new Response(JSON.stringify({ ok: true, task_id: 'task_readiness_test' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }
  if (String(url).includes('/v2/task.listMessages')) {
    resultReads += 1
    if (resultReads === 1) {
      return new Response(JSON.stringify({
        ok: true,
        task_id: 'task_readiness_test',
        messages: [{ type: 'status_update', status_update: { agent_status: 'running' } }],
      }), { status: 200, headers: { 'content-type': 'application/json' } })
    }
    return new Response(JSON.stringify({
      ok: true,
      task_id: 'task_readiness_test',
      messages: [
        { type: 'status_update', status_update: { agent_status: 'stopped' } },
        {
          type: 'structured_output_result',
          structured_output_result: {
            success: true,
            value: {
              headline: 'Make the next commitments easier to see before they become urgent.',
              paragraphs: [
                'The responses indicate that the current operating rhythm may make it harder to see a complete view of the commitments that need attention. That can leave the team assembling information at the same time it needs to decide what to do next, rather than using the view to guide an earlier conversation.',
                'The connected pattern suggests that clarity around acquittal work and ownership may not always move at the same pace as deadline visibility. This can create avoidable coordination effort when contributors need to search for the current position, confirm what evidence is still needed or identify who should progress the next action.',
                'A proportionate first move is to make the three nearest material commitments visible in one shared view, including due date, accountable owner, next action and supporting evidence still needed. This gives the team a practical starting point for earlier escalation and more confident handovers without redesigning every process at once.',
              ],
              discussionPrompt: 'For the next three material commitments, can the accountable owner confirm the next action and evidence still needed without a separate search?',
            },
            error: null,
          },
        },
      ],
    }), { status: 200, headers: { 'content-type': 'application/json' } })
  }
  throw new Error(`Unexpected Manus API URL: ${url}`)
}

try {
  const {
    normaliseReadinessAnswers,
    readinessQuestionIds,
    readReadinessInsightAnalysis,
    startReadinessInsightAnalysis,
  } = await import('../src/utils/portfolioReadinessInsights.js')

  const answers = normaliseReadinessAnswers(readinessQuestionIds.map((id, index) => ({ id, score: index % 4 })))
  const started = await startReadinessInsightAnalysis(answers, '203.0.113.10')
  assert.equal(started.analysisStatus, 'pending')
  assert.ok(started.analysisId)
  assert.equal(started.insight.source, 'guided')

  const createdPayload = JSON.parse(requests[0].options.body)
  assert.equal(requests[0].url, 'https://manus.example.test/v2/task.create')
  assert.equal(requests[0].options.headers['x-manus-api-key'], 'test-key-not-a-secret')
  assert.equal(createdPayload.agent_profile, 'manus-1.6-lite')
  assert.equal(createdPayload.interactive_mode, false)
  assert.equal(createdPayload.hide_in_task_list, true)
  assert.equal(createdPayload.share_visibility, 'private')
  assert.deepEqual(Object.keys(createdPayload.structured_output_schema.properties), ['headline', 'paragraphs', 'discussionPrompt'])
  assert.match(createdPayload.message.content, /anonymous self-reported pattern/i)
  assert.doesNotMatch(createdPayload.message.content, /203\.0\.113\.10|test-key-not-a-secret/i)

  assert.equal(await readReadinessInsightAnalysis(started.analysisId, '203.0.113.11'), null)
  const pending = await readReadinessInsightAnalysis(started.analysisId, '203.0.113.10')
  assert.equal(pending.analysisStatus, 'pending')
  assert.equal(pending.insight.source, 'guided')

  const finished = await readReadinessInsightAnalysis(started.analysisId, '203.0.113.10')
  assert.equal(finished.analysisStatus, 'ready')
  assert.equal(finished.insight.source, 'manus')
  assert.equal(finished.insight.paragraphs.length, 3)
  assert.match(requests[2].url, /task_id=task_readiness_test/)
  console.log('Portfolio readiness Manus structured-analysis smoke tests passed.')
} finally {
  global.fetch = originalFetch
}
