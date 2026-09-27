import { callClaudeText, isClaudeConfigured } from './anthropicClient.js'

const questionDefinitions = [
  { id: 'deadline_visibility', category: 'visibility', label: 'shared deadline visibility', options: ['not reliably', 'partly visible', 'mostly visible', 'consistently visible'] },
  { id: 'forward_planning', category: 'visibility', label: 'forward planning horizon', options: ['less than 30 days', 'about 30 days', '60–90 days', 'more than 90 days'] },
  { id: 'leadership_reporting', category: 'visibility', label: 'leadership portfolio reporting', options: ['difficult', 'possible but manual', 'mostly available', 'readily available'] },
  { id: 'acquittal_checklists', category: 'acquittal', label: 'acquittal checklist coverage', options: ['low confidence', 'some coverage', 'good coverage', 'high confidence'] },
  { id: 'evidence_control', category: 'acquittal', label: 'evidence and document control', options: ['scattered', 'partly organised', 'mostly centralised', 'structured by grant'] },
  { id: 'requirements_visibility', category: 'acquittal', label: 'early visibility of reporting requirements', options: ['often discovered late', 'sometimes discovered late', 'rarely discovered late', 'very rarely discovered late'] },
  { id: 'accountable_ownership', category: 'ownership', label: 'accountable ownership', options: ['usually unclear', 'somewhat clear', 'mostly clear', 'explicit and shared'] },
  { id: 'continuity', category: 'ownership', label: 'continuity when a staff member is unavailable', options: ['with difficulty', 'with a handover', 'reasonably easily', 'easily'] },
  { id: 'shared_tasks', category: 'ownership', label: 'shared task and follow-up control', options: ['inconsistently', 'for major work only', 'mostly consistent', 'consistently shared'] },
]

const categoryDefinitions = {
  visibility: {
    title: 'Portfolio visibility',
    low: 'the team is likely relying on manual collation to establish what is due, what is at risk and what should be raised early. That can make a routine leadership request feel urgent because the current picture is assembled only when someone asks for it.',
    medium: 'useful information is available, but the operating picture may still depend on people checking multiple sources or translating a list into a decision-ready view.',
    high: 'the team has a useful basis for seeing commitments early. The next opportunity is to keep that view current enough to support earlier conversations about capacity, risk and delivery decisions.',
    action: 'Create one live portfolio view for the three nearest material commitments, with the due date, accountable owner, current status and next decision visible together.',
  },
  acquittal: {
    title: 'Acquittal readiness',
    low: 'requirements and supporting evidence may be becoming visible too late in the work. This often turns acquittal into a recovery exercise, with contributors searching for records or clarifying expectations close to a due date.',
    medium: 'there is a workable foundation, although a consistent grant-level checklist and evidence path would reduce the effort needed to confirm that each reporting commitment is complete.',
    high: 'the team has a sound basis for keeping reporting requirements and evidence connected to each grant. The focus is on preserving that discipline as grant volume, contributors or reporting demands change.',
    action: 'For the three highest-risk funded grants, confirm the required evidence, the owner of each open item and the location of the latest approved record.',
  },
  ownership: {
    title: 'Ownership and continuity',
    low: 'grant progress may depend too heavily on individual memory, inboxes or informal handovers. When ownership or the next action is not visible, a leave period or competing priority can make a manageable task harder to restart.',
    medium: 'responsibilities are generally understood, but the next action, contributors and handover context may not be equally visible across all active grants.',
    high: 'the team has a strong foundation for shared delivery. Maintaining clear ownership, next actions and accessible context will help the process remain resilient when responsibilities move between people.',
    action: 'For each active grant, record one accountable owner, the next action, contributors and the evidence that will show the action is complete.',
  },
}

const clampInteger = (value, minimum, maximum, fallback) => {
  const parsed = Number.parseInt(value, 10)
  if (!Number.isInteger(parsed)) return fallback
  return Math.min(Math.max(parsed, minimum), maximum)
}

const compactText = (value, maximum) => String(value || '')
  .replace(/\s+/g, ' ')
  .trim()
  .slice(0, maximum)

export const readinessQuestionIds = questionDefinitions.map((question) => question.id)

export const normaliseReadinessAnswers = (rawAnswers) => {
  if (!Array.isArray(rawAnswers) || rawAnswers.length !== questionDefinitions.length) return null

  const answersById = new Map(rawAnswers.map((answer) => [String(answer?.id || ''), answer?.score]))
  if (answersById.size !== questionDefinitions.length) return null

  const answers = []
  for (const question of questionDefinitions) {
    const rawScore = answersById.get(question.id)
    const score = Number(rawScore)
    if (!Number.isInteger(score) || score < 0 || score > 3) return null
    answers.push({ ...question, score, selectedLabel: question.options[score] })
  }
  return answers
}

const calculateCategoryScores = (answers) => Object.entries(categoryDefinitions)
  .map(([key, definition]) => {
    const categoryAnswers = answers.filter((answer) => answer.category === key)
    const score = Math.round((categoryAnswers.reduce((total, answer) => total + answer.score, 0) / (categoryAnswers.length * 3)) * 100)
    return { key, ...definition, score, answers: categoryAnswers }
  })
  .sort((left, right) => left.score - right.score)

const performanceBand = (score) => {
  if (score < 45) return 'low'
  if (score < 75) return 'medium'
  return 'high'
}

const weakSignals = (category) => category.answers
  .filter((answer) => answer.score < 2)
  .sort((left, right) => left.score - right.score)
  .slice(0, 2)
  .map((answer) => `${answer.label} is currently ${answer.selectedLabel}`)

const insightHeadline = (overallScore) => {
  if (overallScore < 50) return 'The immediate opportunity is to make the work visible earlier.'
  if (overallScore < 75) return 'The foundations are there; consistency is the next gain.'
  return 'The next gain is to protect the good operating rhythm you have built.'
}

/**
 * Produces a valuable, explainable interpretation without a model call. It is
 * the safe default on every environment and the fallback for a provider error.
 */
export const buildGuidedReadinessInsight = (answers) => {
  const categories = calculateCategoryScores(answers)
  const [primary, secondary] = categories
  const total = answers.reduce((sum, answer) => sum + answer.score, 0)
  const overallScore = Math.round((total / (answers.length * 3)) * 100)
  const primarySignals = weakSignals(primary)
  const secondarySignals = weakSignals(secondary)
  const primaryDetail = primarySignals.length
    ? `In particular, ${primarySignals.join(' and ')}.`
    : `This is the area most worth protecting as the portfolio changes.`
  const connectedDetail = secondarySignals.length
    ? `The related signal is that ${secondarySignals.join(' and ')}.`
    : `The related operating area is ${secondary.title.toLowerCase()}.`

  return {
    headline: insightHeadline(overallScore),
    paragraphs: [
      `Your clearest operating pressure point is ${primary.title.toLowerCase()}. Based on the responses, ${primary[performanceBand(primary.score)]} ${primaryDetail}`,
      `${connectedDetail} When ${primary.title.toLowerCase()} and ${secondary.title.toLowerCase()} are not equally visible, teams can spend more time reconstructing the current position than discussing the decision or contribution that is needed next. This points to an operating-system opportunity, not a judgement about individual commitment.`,
      `A useful first move is deliberately small: ${primary.action} The outcome to aim for is a calmer, shared view of the work closest to due, so issues can be raised earlier and contributors can act with less follow-up.`,
    ],
    discussionPrompt: `At the next portfolio review, ask: “For the next three material commitments, can we see the due date, accountable owner, next action and latest supporting evidence without a separate follow-up?”`,
    categoryScores: categories.map(({ key, score }) => ({ key, score })),
    source: 'guided',
  }
}

const readAiConfiguration = () => {
  const enabled = String(process.env.READINESS_INSIGHT_AI_ENABLED || '').toLowerCase() === 'true'
  const model = String(process.env.READINESS_INSIGHT_AI_MODEL || 'claude-haiku-4-5').trim()
  const timeout = clampInteger(process.env.READINESS_INSIGHT_AI_TIMEOUT_MS, 1000, 15000, 8000)
  return { enabled: enabled && isClaudeConfigured(), model, timeout }
}

const cache = new Map()
const cacheLimit = 200
let dailyUsage = { date: '', count: 0 }

const cacheKeyFor = (answers) => answers.map((answer) => `${answer.id}:${answer.score}`).join('|')
const getCached = (key) => {
  const value = cache.get(key)
  if (!value || value.expiresAt < Date.now()) {
    cache.delete(key)
    return null
  }
  cache.delete(key)
  cache.set(key, value)
  return value.insight
}
const putCached = (key, insight) => {
  cache.set(key, { insight, expiresAt: Date.now() + 24 * 60 * 60 * 1000 })
  while (cache.size > cacheLimit) cache.delete(cache.keys().next().value)
}
const canUseModelToday = () => {
  const today = new Date().toISOString().slice(0, 10)
  if (dailyUsage.date !== today) dailyUsage = { date: today, count: 0 }
  const cap = clampInteger(process.env.READINESS_INSIGHT_DAILY_LIMIT, 1, 10000, 100)
  if (dailyUsage.count >= cap) return false
  dailyUsage.count += 1
  return true
}

const validateModelInsight = (rawInsight, guided) => {
  const headline = compactText(rawInsight?.headline, 120)
  const paragraphs = Array.isArray(rawInsight?.paragraphs)
    ? rawInsight.paragraphs.map((paragraph) => compactText(paragraph, 700)).filter(Boolean)
    : []
  const discussionPrompt = compactText(rawInsight?.discussionPrompt, 300)

  if (!headline || paragraphs.length !== 3 || paragraphs.some((paragraph) => paragraph.length < 90) || !discussionPrompt) return null
  return { ...guided, headline, paragraphs, discussionPrompt, source: 'ai' }
}

const createModelPrompt = (answers, guided) => {
  const categories = calculateCategoryScores(answers)
  const answerSummary = answers.map((answer) => `- ${answer.label}: ${answer.selectedLabel}`).join('\n')
  const categorySummary = categories.map((category) => `- ${category.title}: ${category.score}/100`).join('\n')

  return `Interpret this anonymous Grant Portfolio Risk & Readiness Snapshot for an Australian or New Zealand local-government or public-purpose grants team. The answers are self-reported and contain no personal, organisation, grant, funder, financial or document data.

Category pattern:
${categorySummary}

Answer pattern:
${answerSummary}

Return a concise, useful interpretation that is grounded only in this pattern. Write three paragraphs of 55–85 words. Paragraph one explains the most meaningful operating pattern. Paragraph two explains the likely coordination consequence without presenting it as fact. Paragraph three gives one proportionate, practical first move. Then add one short leadership-discussion prompt.

Use plain Australian English. Do not mention AI, GrantMaestro, a score, laws, formal compliance, audit, certification, financial savings, security guarantees, or facts not supplied. Do not use bullets, markdown, jargon, fear, promises or calls to buy. Make clear through the wording that this is a practical reflection rather than a formal assessment.

Return only a valid JSON object with this exact shape:
{"headline":"...","paragraphs":["...","...","..."],"discussionPrompt":"..."}`
}

const parseModelJson = (content) => {
  const normalised = String(content || '')
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/, '')
  return JSON.parse(normalised)
}

/**
 * Uses a provider only when it is explicitly enabled in the server environment.
 * The model sees anonymous score/label data only. Failure always returns the
 * deterministic guided interpretation so visitors keep receiving value.
 */
export const createReadinessInsight = async (answers) => {
  const guided = buildGuidedReadinessInsight(answers)
  const key = cacheKeyFor(answers)
  const cached = getCached(key)
  if (cached) return cached

  const configuration = readAiConfiguration()
  if (!configuration.enabled || !canUseModelToday()) {
    putCached(key, guided)
    return guided
  }

  try {
    const content = await callClaudeText({
      model: configuration.model,
      maxTokens: 800,
      temperature: 0.2,
      timeout: configuration.timeout,
      systemPrompt: 'You are a careful public-sector grants operations adviser. Treat supplied scores as limited self-reported signals, not verified facts. Output only valid JSON.',
      userPrompt: createModelPrompt(answers, guided),
    })
    const insight = validateModelInsight(parseModelJson(content), guided) || guided
    putCached(key, insight)
    return insight
  } catch (error) {
    console.warn('[portfolio-readiness] AI interpretation unavailable; using guided interpretation.')
    putCached(key, guided)
    return guided
  }
}
