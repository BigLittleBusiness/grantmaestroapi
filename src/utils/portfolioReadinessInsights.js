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

const structuredInsightSchema = {
  type: 'object',
  properties: {
    headline: { type: 'string', description: 'A concise, outcome-led interpretation headline.' },
    paragraphs: { type: 'array', items: { type: 'string' }, description: 'Exactly three plain-English reflection paragraphs.' },
    discussionPrompt: { type: 'string', description: 'One short question for the next portfolio review.' },
  },
  required: ['headline', 'paragraphs', 'discussionPrompt'],
  additionalProperties: false,
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
 * Produces a valuable, explainable interpretation without an external call.
 * This is always returned immediately and is the safe fallback for a disabled,
 * rate-limited or unavailable Manus workflow.
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
    : 'This is the area most worth protecting as the portfolio changes.'
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
    discussionPrompt: 'At the next portfolio review, ask: “For the next three material commitments, can we see the due date, accountable owner, next action and latest supporting evidence without a separate follow-up?”',
    categoryScores: categories.map(({ key, score }) => ({ key, score })),
    source: 'guided',
  }
}

const readManusConfiguration = () => {
  const enabled = String(process.env.MANUS_READINESS_ANALYSIS_ENABLED || '').toLowerCase() === 'true'
  const apiKey = String(process.env.MANUS_API_KEY || '').trim()
  const apiBase = String(process.env.MANUS_API_BASE || 'https://api.manus.ai').trim().replace(/\/$/, '')
  const profile = String(process.env.MANUS_READINESS_AGENT_PROFILE || 'manus-1.6-lite').trim()
  const requestTimeout = clampInteger(process.env.MANUS_READINESS_REQUEST_TIMEOUT_MS, 2000, 20000, 12000)
  return { enabled: enabled && Boolean(apiKey), apiKey, apiBase, profile, requestTimeout }
}

const cache = new Map()
const cacheLimit = 200
const analysisStore = new Map()
const analysisLimit = 200
const analysisLifetimeMs = 10 * 60 * 1000
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
const pruneAnalysisStore = () => {
  const now = Date.now()
  for (const [analysisId, record] of analysisStore) {
    if (record.expiresAt < now) analysisStore.delete(analysisId)
  }
  while (analysisStore.size > analysisLimit) analysisStore.delete(analysisStore.keys().next().value)
}
const canStartAnalysisToday = () => {
  const today = new Date().toISOString().slice(0, 10)
  if (dailyUsage.date !== today) dailyUsage = { date: today, count: 0 }
  const cap = clampInteger(process.env.MANUS_READINESS_DAILY_LIMIT, 1, 10000, 25)
  if (dailyUsage.count >= cap) return false
  dailyUsage.count += 1
  return true
}

const validateStructuredInsight = (rawInsight, guided) => {
  const headline = compactText(rawInsight?.headline, 120)
  const paragraphs = Array.isArray(rawInsight?.paragraphs)
    ? rawInsight.paragraphs.map((paragraph) => compactText(paragraph, 700)).filter(Boolean)
    : []
  const discussionPrompt = compactText(rawInsight?.discussionPrompt, 300)

  if (!headline || paragraphs.length !== 3 || paragraphs.some((paragraph) => paragraph.length < 90) || !discussionPrompt) return null
  return { ...guided, headline, paragraphs, discussionPrompt, source: 'manus' }
}

const createAnalysisPrompt = (answers) => {
  const categories = calculateCategoryScores(answers)
  const answerSummary = answers.map((answer) => `- ${answer.label}: ${answer.selectedLabel}`).join('\n')
  const categorySummary = categories.map((category) => `- ${category.title}: ${category.score}/100`).join('\n')

  return `You are preparing a concise, practical Grant Portfolio Risk & Readiness reflection for an Australian or New Zealand local-government or public-purpose grants team. Do not browse, use external tools, look up external sources, ask a question or take an external action. Work only from the anonymous self-reported pattern below.

The pattern contains no name, email, organisation, grant, funder, financial, document, IP-address or free-text data.

Category pattern:
${categorySummary}

Answer pattern:
${answerSummary}

Produce the structured output requested. Write exactly three plain-Australian-English paragraphs of 55–85 words: (1) the most meaningful operating pattern, (2) a likely coordination consequence framed as possibility rather than fact, and (3) one proportionate practical first move. Then write one short leadership-discussion question.

Do not mention AI, Manus, GrantMaestro, a score, laws, formal compliance, audit, certification, financial savings, security guarantees, or facts not supplied. Do not use bullets, markdown, jargon, fear, promises or a sales call. Make clear through the wording that this is a practical reflection, not a formal assessment.`
}

const requestManus = async (configuration, path, options = {}) => {
  const abortController = new AbortController()
  const timeoutId = setTimeout(() => abortController.abort(), configuration.requestTimeout)
  try {
    const response = await fetch(`${configuration.apiBase}${path}`, {
      ...options,
      headers: {
        'content-type': 'application/json',
        'x-manus-api-key': configuration.apiKey,
        ...(options.headers || {}),
      },
      signal: abortController.signal,
    })
    const body = await response.json().catch(() => ({}))
    if (!response.ok || body?.ok !== true) throw new Error(`Manus API request failed with ${response.status}`)
    return body
  } finally {
    clearTimeout(timeoutId)
  }
}

const startManusTask = async (configuration, answers) => {
  const response = await requestManus(configuration, '/v2/task.create', {
    method: 'POST',
    body: JSON.stringify({
      title: 'GrantMaestro anonymous readiness reflection',
      locale: 'en',
      interactive_mode: false,
      hide_in_task_list: true,
      share_visibility: 'private',
      agent_profile: configuration.profile,
      message: { content: createAnalysisPrompt(answers) },
      structured_output_schema: structuredInsightSchema,
    }),
  })
  if (!response.task_id) throw new Error('Manus did not return a task ID.')
  return response.task_id
}

const readManusTaskResult = async (configuration, taskId) => {
  const response = await requestManus(configuration, `/v2/task.listMessages?task_id=${encodeURIComponent(taskId)}&order=desc&limit=50`, {
    method: 'GET',
  })
  const events = Array.isArray(response.messages) ? response.messages : []
  const structuredResult = events.find((event) => event?.type === 'structured_output_result')?.structured_output_result
  if (structuredResult?.success) return { status: 'ready', value: structuredResult.value }
  if (events.some((event) => event?.type === 'error_message' || event?.status_update?.agent_status === 'error' || event?.status_update?.agent_status === 'waiting')) return { status: 'unavailable' }
  if (events.some((event) => event?.status_update?.agent_status === 'stopped')) return { status: 'unavailable' }
  return { status: 'pending' }
}

/**
 * Starts an optional Manus structured-analysis task. The visitor gets the
 * guided reflection immediately; no contact or free-text data is submitted.
 */
export const startReadinessInsightAnalysis = async (answers, requesterIp = '') => {
  const guided = buildGuidedReadinessInsight(answers)
  const key = cacheKeyFor(answers)
  const cached = getCached(key)
  if (cached) return { insight: cached, analysisStatus: 'ready' }

  const configuration = readManusConfiguration()
  if (!configuration.enabled || !canStartAnalysisToday()) return { insight: guided, analysisStatus: 'guided' }

  try {
    const taskId = await startManusTask(configuration, answers)
    pruneAnalysisStore()
    const analysisId = crypto.randomUUID()
    analysisStore.set(analysisId, {
      requesterIp: String(requesterIp || ''),
      taskId,
      key,
      guided,
      expiresAt: Date.now() + analysisLifetimeMs,
    })
    return { insight: guided, analysisStatus: 'pending', analysisId }
  } catch (error) {
    console.warn('[portfolio-readiness] Manus analysis unavailable; using guided interpretation.')
    return { insight: guided, analysisStatus: 'guided' }
  }
}

/**
 * Reads a task result for the same anonymous visitor. The opaque analysis ID is
 * short lived, held in memory only and never reveals the Manus task ID.
 */
export const readReadinessInsightAnalysis = async (analysisId, requesterIp = '') => {
  pruneAnalysisStore()
  const record = analysisStore.get(String(analysisId || ''))
  if (!record || record.requesterIp !== String(requesterIp || '')) return null

  const configuration = readManusConfiguration()
  if (!configuration.enabled) {
    analysisStore.delete(analysisId)
    return { insight: record.guided, analysisStatus: 'guided' }
  }

  try {
    const result = await readManusTaskResult(configuration, record.taskId)
    if (result.status === 'pending') return { insight: record.guided, analysisStatus: 'pending' }

    analysisStore.delete(analysisId)
    const insight = result.status === 'ready'
      ? validateStructuredInsight(result.value, record.guided) || record.guided
      : record.guided
    if (insight.source === 'manus') putCached(record.key, insight)
    return { insight, analysisStatus: insight.source === 'manus' ? 'ready' : 'guided' }
  } catch (error) {
    console.warn('[portfolio-readiness] Manus analysis result unavailable; using guided interpretation.')
    analysisStore.delete(analysisId)
    return { insight: record.guided, analysisStatus: 'guided' }
  }
}
