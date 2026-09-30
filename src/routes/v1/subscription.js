import express from 'express'
import protect from '../../middlewares/auth.js'
import { fetchSubscriptionPlans } from '../../controllers/subscriptionController.js'
import {
  createPinCharge,
  pinWebhook,
} from '../../controllers/pinPaymentController.js'
import { validatePromoCode } from '../../controllers/adminPlansController.js'
import {
  confirmCheckoutSession,
  createCheckoutSession,
  getPaymentProvider,
} from '../../controllers/paymentController.js'

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
subscriptionRouter.post('/create-checkout-session', protect, createCheckoutSession)

/**
 * @swagger
 * /v1/subscription/payment-provider:
 *   get:
 *     summary: The active payment provider (stripe or pin).
 *     tags:
 *       - Subscription
 *     security:
 *       - bearerAuth: []
 */
subscriptionRouter.get('/payment-provider', protect, getPaymentProvider)

/**
 * @swagger
 * /v1/subscription/checkout-session/{sessionId}:
 *   get:
 *     summary: Confirm a completed Stripe checkout session and return its totals (including GST).
 *     tags:
 *       - Subscription
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Checkout session status and totals.
 */
subscriptionRouter.get('/checkout-session/:sessionId', protect, confirmCheckoutSession)

/**
 * @swagger
 * /v1/subscription/create-charge:
 *   post:
 *     summary: Create a Pin Payments charge and activate subscription.
 *     tags:
 *       - Subscription
 *     security:
 *       - bearerAuth: []
 */
subscriptionRouter.post('/create-charge', protect, createPinCharge)

/**
 * @swagger
 * /v1/subscription/pin-webhook:
 *   post:
 *     summary: Receive Pin Payments webhook events.
 *     tags:
 *       - Subscription
 */
subscriptionRouter.post('/pin-webhook', pinWebhook)

// Public — validate a promo code (no auth required)
subscriptionRouter.post('/validate-promo', validatePromoCode)

export default subscriptionRouter
