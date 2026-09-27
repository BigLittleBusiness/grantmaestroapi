import assert from 'node:assert/strict'

process.env.MANUS_READINESS_ANALYSIS_ENABLED = 'false'
delete process.env.MANUS_API_KEY
const {
  buildGuidedReadinessInsight,
  normaliseReadinessAnswers,
  readinessQuestionIds,
  startReadinessInsightAnalysis,
} = await import('../src/utils/portfolioReadinessInsights.js')

const mixedAnswers = readinessQuestionIds.map((id, index) => ({ id, score: index % 4 }))
const answers = normaliseReadinessAnswers(mixedAnswers)
assert.equal(answers.length, 9)
assert.equal(normaliseReadinessAnswers(mixedAnswers.slice(1)), null)
assert.equal(normaliseReadinessAnswers(mixedAnswers.map((answer, index) => index === 0 ? { ...answer, score: 4 } : answer)), null)

const guided = buildGuidedReadinessInsight(answers)
assert.equal(guided.source, 'guided')
assert.equal(guided.paragraphs.length, 3)
assert.ok(guided.paragraphs.every((paragraph) => paragraph.length > 90))
assert.ok(guided.discussionPrompt.includes('next three material commitments'))

const analysis = await startReadinessInsightAnalysis(answers, '203.0.113.20')
assert.equal(analysis.analysisStatus, 'guided')
assert.equal(analysis.insight.source, 'guided')
assert.equal(analysis.insight.paragraphs.length, 3)
console.log('Portfolio readiness guided insight smoke tests passed.')
