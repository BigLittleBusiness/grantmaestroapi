import asyncHandler from '../middlewares/async.js'
import base from '../models/base.js'
import Stripe from 'stripe'

const { SubscriptionPlans } = base

/**
 * Creates a new subscription plan in Stripe and stores the plan details in the database.
 * @async
 * @function createSubscriptionPlan
 * @param {Object} req - Express request object.
 * @param {Object} req.body - Request body containing subscription details.
 * @param {number} req.body.amount - The amount for the subscription plan.
 * @param {string} req.body.billing_interval - The billing interval (e.g., 'month', 'year').
 * @param {Object} res - Express response object.
 * @param {Function} next - Express next middleware function.
 */
export const createSubscriptionPlan = asyncHandler(async (req, res, next) => {
  const { amount, billing_interval } = req.body

  const billingAmt = amount * 100
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
  const plan = await stripe.prices.create({
    unit_amount: billingAmt,
    currency: 'usd',
    billing_scheme: 'per_unit',
    recurring: {
      interval: billing_interval, //'month',
    },
    product_data: {
      name: 'GrantTestSubscription',
    },
  })
  if (plan.id) {
    const planObj = {
      plan_name: '',
      plan_description: '',
      plan_duration: billing_interval,
      stripe_plan_id: plan.id,
      plan_price: amount,
    }
    await SubscriptionPlans.create(planObj)
  } else {
    return res.send({
      status: false,
      message: 'Unable to create subacription plan',
    })
  }
  res.send({
    status: true,
    message: 'subscription plan created successfully',
  })
})

/**
 * Updates an existing subscription plan.
 * @async
 * @function updateSubscriptionPlan
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @param {Function} next - Express next middleware function.
 */
export const updateSubscriptionPlan = asyncHandler(async (req, res, next) => {})

/**
 * Fetches all active subscription plans from the database.
 * @async
 * @function fetchSubscriptionPlans
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @param {Function} next - Express next middleware function.
 */
export const fetchSubscriptionPlans = asyncHandler(async (req, res, next) => {
  const plans = await SubscriptionPlans.findAll({
    attributes: [
      'plan_id',
      'plan_name',
      'plan_description',
      'plan_duration',
      'plan_price',
      'stripe_plan_id',
    ],
    where: { is_blocked: 0, is_deleted: 0 },
  })
  res.send({
    status: true,
    message: 'List of subscription plans',
    data: { plans },
  })
})

/**
 * Retrieves details of a specific subscription plan.
 * @async
 * @function getSubscriptionPlan
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @param {Function} next - Express next middleware function.
 */
export const getSubscriptionPlan = asyncHandler(async (req, res, next) => {})

/**
 * Removes a subscription plan by marking it as deleted or blocked.
 * @async
 * @function removeSubscriptionPlan
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @param {Function} next - Express next middleware function.
 */
export const removeSubscriptionPlan = asyncHandler(async (req, res, next) => {})
