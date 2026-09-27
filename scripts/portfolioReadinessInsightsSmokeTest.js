import assert from 'node:assert/strict'

process.env.READINESS_INSIGHT_AI_ENABLED = 'false'
const {
  buildGuidedReadinessInsight,
  createReadinessInsight,
  normaliseReadinessAnswers,
  readinessQuestionIds,
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

const generated = await createReadinessInsight(answers)
assert.equal(generated.source, 'guided')
assert.equal(generated.paragraphs.length, 3)
console.log('Portfolio readiness insight utility smoke tests passed.')
