import express from 'express'
import rateLimit from 'express-rate-limit'
import {
  getPortfolioReadinessConfiguration,
  getPortfolioReadinessInterpretationStatus,
  interpretPortfolioReadiness,
  submitPortfolioReadinessRequest,
} from '../../controllers/portfolioReadinessController.js'

const portfolioReadinessRouter = express.Router()
const interpretationStartLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 6,
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: false, message: 'Too many readiness interpretations have been requested. Please try again later.' },
})
const interpretationStatusLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: false, message: 'This readiness analysis is taking longer than expected. Please use the reflection already shown.' },
})
const actionPlanLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: false, message: 'Too many action-plan requests have been submitted. Please try again later.' },
})

// The site key is public by design. Turnstile verification and mail settings
// remain server-only and are checked before accepting a request.
portfolioReadinessRouter.get('/config', getPortfolioReadinessConfiguration)
portfolioReadinessRouter.post('/interpretation', interpretationStartLimiter, interpretPortfolioReadiness)
portfolioReadinessRouter.get('/interpretation/:analysisId', interpretationStatusLimiter, getPortfolioReadinessInterpretationStatus)
portfolioReadinessRouter.post('/', actionPlanLimiter, submitPortfolioReadinessRequest)

export default portfolioReadinessRouter
