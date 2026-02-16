import express from 'express'
import protect from '../../middlewares/auth.js'
import {
  createSubscriptionPlan,
  fetchSubscriptionPlans,
} from '../../controllers/subscriptionController.js'
import { createCheckoutSession } from '../../controllers/paymentController.js'

import { subscriptionExpiryDate } from '../../controllers/authController.js'

const subscriptionRouter = express.Router()

/**
 * @swagger
 * /v1/subscription/fetch-subscription-plans:
 *   get:
 *     summary: Fetch all active subscription plans.
 *     tags:
 *       - Subscription
 *     responses:
 *       200:
 *         description: List of subscription plans.
 */
subscriptionRouter.get('/fetch-subscription-plans', fetchSubscriptionPlans)

/**
 * @swagger
 * /v1/subscription/update-subscription-expiry-date:
 *   post:
 *     summary: Update the subscription expiry date for a user.
 *     tags:
 *       - Subscription
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Subscription expiry date updated successfully.
 */
subscriptionRouter.post(
  '/update-subscription-expiry-date',
  protect,
  subscriptionExpiryDate
)

/**
 * @swagger
 * /v1/subscription/create-checkout-session:
 *   post:
 *     summary: Create a Stripe checkout session for subscription payment.
 *     tags:
 *       - Subscription
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Checkout session created successfully.
 */
subscriptionRouter.post(
  '/create-checkout-session',
  protect,
  createCheckoutSession
)

/**
 * @swagger
 * /v1/subscription/create-subscription-plan:
 *   post:
 *     summary: Create a new subscription plan.
 *     tags:
 *       - Subscription
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Subscription plan created successfully.
 */
subscriptionRouter.post(
  '/create-subscription-plan',
  protect,
  createSubscriptionPlan
)

export default subscriptionRouter
