import express from 'express'
import {
  getPortfolioReadinessConfiguration,
  interpretPortfolioReadiness,
  submitPortfolioReadinessRequest,
} from '../../controllers/portfolioReadinessController.js'

const portfolioReadinessRouter = express.Router()

// The site key is public by design. Turnstile verification and mail settings
// remain server-only and are checked before accepting a request.
portfolioReadinessRouter.get('/config', getPortfolioReadinessConfiguration)
portfolioReadinessRouter.post('/interpretation', interpretPortfolioReadiness)
portfolioReadinessRouter.post('/', submitPortfolioReadinessRequest)

export default portfolioReadinessRouter
