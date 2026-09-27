import asyncHandler from '../middlewares/async.js'
import sendEmail, { isMailConfigured, resolveMailConfig } from '../utils/mailHelper.js'
import { getContactRecipient } from '../utils/contactRecipient.js'
import { verifyTurnstile } from '../utils/turnstile.js'
import { createReadinessInsight, normaliseReadinessAnswers } from '../utils/portfolioReadinessInsights.js'

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const allowedRoles = new Set([
  'Grants or programme manager',
  'Finance or governance leader',
  'Executive or director',
  'Project or delivery team member',
  'Other',
])
const categoryActions = {
  visibility: {
    title: 'Create one live portfolio view',
    detail: 'Bring opportunities, reports and acquittal dates into one shared, action-led view. Review the next 90 days with the relevant owners.',
  },
  acquittal: {
    title: 'Standardise your acquittal checklist',
    detail: 'Start with the three highest-risk funded grants: confirm requirements, assign ownership and bring the missing evidence into view.',
  },
  ownership: {
    title: 'Make next actions and owners visible',
    detail: 'For each active grant, record one accountable owner, the next action, contributors and what completion evidence is required.',
  },
}
const labelByScore = (score) => {
  if (score < 50) return 'High coordination risk'
  if (score < 75) return 'Developing control'
  return 'Strong foundations'
}
const sanitiseText = (value, maxLength) => String(value || '')
  .replace(/[\r\n]+/g, ' ')
  .trim()
  .slice(0, maxLength)
const normaliseScore = (value) => {
  const score = Number(value)
  return Number.isFinite(score) && score >= 0 && score <= 100 ? Math.round(score) : null
}
const getPriorities = (rawCategories) => {
  if (!Array.isArray(rawCategories)) return []
  return rawCategories
    .map((category) => ({
      key: sanitiseText(category?.key, 40),
      score: normaliseScore(category?.score),
    }))
    .filter((category) => categoryActions[category.key] && category.score !== null)
    .sort((left, right) => left.score - right.score)
    .map((category) => ({ key: category.key, score: category.score, ...categoryActions[category.key] }))
}
const publicOrigin = () => String(process.env.FRONTEND_URL || 'https://www.grantmaestro.com').replace(/\/$/, '')

const formIsConfigured = async () => {
  const mailConfig = await resolveMailConfig()
  return Boolean(
    process.env.TURNSTILE_SITE_KEY
    && process.env.TURNSTILE_SECRET_KEY
    && getContactRecipient()
    && isMailConfigured(mailConfig)
  )
}

export const getPortfolioReadinessConfiguration = asyncHandler(async (req, res) => {
  const configured = await formIsConfigured()
  res.status(200).json({
    status: true,
    data: {
      turnstileSiteKey: configured ? process.env.TURNSTILE_SITE_KEY : '',
      message: configured ? '' : 'Action-plan email delivery is temporarily unavailable. You can still use the on-screen priorities below.',
    },
  })
})

/**
 * Returns a privacy-minimised, answer-specific interpretation before the
 * optional lead form. Only fixed question IDs and integer answer scores are
 * accepted; contact fields and free-text input cannot reach an AI provider.
 */
export const interpretPortfolioReadiness = asyncHandler(async (req, res) => {
  const answers = normaliseReadinessAnswers(req.body?.answers)
  if (!answers) {
    return res.status(422).json({
      status: false,
      message: 'Please complete the readiness snapshot before requesting an interpretation.',
    })
  }

  const insight = await createReadinessInsight(answers)
  return res.status(200).json({ status: true, data: insight })
})

export const submitPortfolioReadinessRequest = asyncHandler(async (req, res) => {
  if (!await formIsConfigured()) {
    return res.status(503).json({
      status: false,
      message: 'Action-plan email delivery is temporarily unavailable. Please use the on-screen priorities and try again later.',
    })
  }

  const firstName = sanitiseText(req.body.firstName, 120)
  const email = sanitiseText(req.body.email, 254).toLowerCase()
  const organisation = sanitiseText(req.body.organisation, 160)
  const role = sanitiseText(req.body.role, 100)
  const website = sanitiseText(req.body.website, 255)
  const sourceUrl = sanitiseText(req.body.sourceUrl, 1000)
  const marketingConsent = req.body.marketingConsent === true
  const assessment = req.body.assessment || {}
  const score = normaliseScore(assessment.score)
  const priorities = getPriorities(assessment.categories)

  // Quietly accept honeypot submissions without sending email or retaining data.
  if (website) return res.status(200).json({ status: true, message: 'Your action plan is on its way.' })

  if (!firstName || !emailPattern.test(email) || !organisation || !allowedRoles.has(role) || !marketingConsent || score === null || priorities.length !== 3) {
    return res.status(422).json({
      status: false,
      message: 'Please complete the form, consent and assessment before requesting your action plan.',
    })
  }

  const captcha = await verifyTurnstile(req.body.captchaToken, req.ip)
  if (captcha.configurationError) {
    return res.status(503).json({ status: false, message: 'Action-plan email delivery is temporarily unavailable. Please try again later.' })
  }
  if (!captcha.success) return res.status(422).json({ status: false, message: captcha.error })

  const assessmentUrl = `${publicOrigin()}/grant-portfolio-readiness`
  const actionPlanDelivery = await sendEmail(
    email,
    'GrantMaestro - Your Grant Portfolio Readiness Action Plan',
    'portfolioReadinessActionPlan',
    {
      firstName,
      organisation,
      score,
      readinessLabel: labelByScore(score),
      priorities,
      assessmentUrl,
      walkthroughUrl: `${publicOrigin()}/contact?topic=demo`,
      privacyUrl: `${publicOrigin()}/privacy-policy`,
      year: new Date().getFullYear(),
    }
  )

  if (!actionPlanDelivery.delivered) {
    return res.status(503).json({ status: false, message: 'Your action plan could not be emailed right now. Please try again shortly.' })
  }

  const recipient = getContactRecipient()
  const leadAlert = await sendEmail(
    recipient,
    'GrantMaestro - Portfolio readiness action plan request',
    'portfolioReadinessLeadAlert',
    {
      firstName,
      email,
      organisation,
      role,
      score,
      readinessLabel: labelByScore(score),
      priorities,
      sourceUrl: sourceUrl || assessmentUrl,
      receivedAt: new Date().toLocaleString('en-AU', { timeZone: 'Australia/Sydney' }),
      year: new Date().getFullYear(),
    },
    null,
    { replyTo: email }
  )

  if (!leadAlert.delivered) console.warn('[portfolio-readiness] Action plan sent but internal lead alert could not be delivered.')

  return res.status(201).json({ status: true, message: 'Your action plan is on its way.' })
})
