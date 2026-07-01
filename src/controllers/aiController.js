import asyncHandler from '../middlewares/async.js'
import OpenAI from 'openai'

/**
 * Lazily initialise the OpenAI client so the server still starts even if
 * OPENAI_API_KEY is not yet configured in the deployment environment.
 */
const getOpenAI = () => {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not configured on this server.')
  }
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: process.env.OPENAI_API_BASE || 'https://api.openai.com/v1',
  })
}

/**
 * Helper — call the chat completions endpoint and return the trimmed text.
 * @param {string} systemPrompt
 * @param {string} userPrompt
 * @returns {Promise<string>}
 */
const chat = async (systemPrompt, userPrompt) => {
  const openai = getOpenAI()
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.4,
    max_tokens: 512,
  })
  return completion.choices[0].message.content.trim()
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /v1/ai/suitability
// Body: { grant_title, fund_originator, category, max_fund_amount,
//         closing_date, organization_name, organization_description }
// Returns: { score: 1-10, rationale: "...", recommendation: "Apply|Review|Pass" }
// ─────────────────────────────────────────────────────────────────────────────
export const scoreSuitability = asyncHandler(async (req, res) => {
  const {
    grant_title,
    fund_originator,
    category,
    max_fund_amount,
    closing_date,
    organization_name,
    organization_description,
  } = req.body

  if (!grant_title) {
    return res.status(422).json({ success: false, message: 'grant_title is required.' })
  }

  const systemPrompt = `You are an expert grant strategist with 20 years of experience helping
Australian not-for-profit organisations assess grant opportunities.
You respond only with valid JSON — no markdown, no extra text.`

  const userPrompt = `Assess the suitability of the following grant opportunity for the organisation described.

Grant details:
- Title: ${grant_title}
- Funder: ${fund_originator || 'Unknown'}
- Category: ${category || 'Not specified'}
- Maximum funding: ${max_fund_amount ? `$${Number(max_fund_amount).toLocaleString('en-AU')}` : 'Not specified'}
- Closing date: ${closing_date || 'Not specified'}

Organisation:
- Name: ${organization_name || 'Not specified'}
- Description: ${organization_description || 'Not provided'}

Return a JSON object with exactly these fields:
{
  "score": <integer 1-10>,
  "rationale": "<two to three sentences explaining the score>",
  "recommendation": "<one of: Apply | Review | Pass>",
  "key_considerations": ["<up to three short bullet points>"]
}`

  const raw = await chat(systemPrompt, userPrompt)

  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch {
    return res.status(500).json({ success: false, message: 'AI returned an unparseable response. Please try again.' })
  }

  res.json({ success: true, data: parsed })
})

// ─────────────────────────────────────────────────────────────────────────────
// POST /v1/ai/task-description
// Body: { grant_title, task_type, assignee_role, due_date }
// Returns: { description: "..." }
// ─────────────────────────────────────────────────────────────────────────────
export const generateTaskDescription = asyncHandler(async (req, res) => {
  const { grant_title, task_type, assignee_role, due_date } = req.body

  if (!grant_title) {
    return res.status(422).json({ success: false, message: 'grant_title is required.' })
  }

  const systemPrompt = `You are a grants coordinator who writes clear, actionable task descriptions
for grant management workflows. Be concise and specific. Do not use bullet points.
Respond with plain text only — no markdown, no JSON.`

  const userPrompt = `Write a single-paragraph task description (2–3 sentences) for the following:

Grant: ${grant_title}
Task type: ${task_type || 'General task'}
Assignee role: ${assignee_role || 'Team member'}
Due date: ${due_date || 'Not specified'}

The description should explain what needs to be done, why it matters for the grant, and any important context.`

  const description = await chat(systemPrompt, userPrompt)
  res.json({ success: true, data: { description } })
})

// ─────────────────────────────────────────────────────────────────────────────
// POST /v1/ai/draft-note
// Body: { grant_title, fund_originator, note_type, context }
//   note_type: "finding" | "suitability" | "submission" | "outcome" | "financial"
// Returns: { note: "..." }
// ─────────────────────────────────────────────────────────────────────────────
export const draftNote = asyncHandler(async (req, res) => {
  const { grant_title, fund_originator, note_type, context } = req.body

  if (!grant_title || !note_type) {
    return res.status(422).json({ success: false, message: 'grant_title and note_type are required.' })
  }

  const noteTypeLabels = {
    finding: 'initial finding / discovery note',
    suitability: 'suitability assessment note',
    submission: 'submission preparation note',
    outcome: 'outcome / decision note',
    financial: 'financial acquittal note',
  }
  const label = noteTypeLabels[note_type] || note_type

  const systemPrompt = `You are a senior grants manager writing structured internal notes for a grant management system.
Write in a professional, factual tone. Do not use bullet points. Respond with plain text only.`

  const userPrompt = `Draft a ${label} for the following grant.

Grant: ${grant_title}
Funder: ${fund_originator || 'Not specified'}
Additional context provided by the user: ${context || 'None'}

Write 2–4 sentences that would be useful as an internal record. Be specific and actionable.`

  const note = await chat(systemPrompt, userPrompt)
  res.json({ success: true, data: { note } })
})
