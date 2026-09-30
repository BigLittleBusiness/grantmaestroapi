import asyncHandler from '../middlewares/async.js'
import base from '../models/base.js'

const { SubscriptionPlans } = base

/**
 * Fetches all active subscription plans for the public pricing page and checkout.
 * Plans are managed by the Platform Admin (adminPlansController) and their
 * prices are kept in line with Stripe by `npm run stripe:setup`.
 * @route GET /v1/subscription/fetch-subscription-plans
 */
export const fetchSubscriptionPlans = asyncHandler(async (req, res) => {
  const plans = await SubscriptionPlans.findAll({
    attributes: [
      'plan_id',
      'plan_name',
      'plan_description',
      'plan_duration',
      'plan_price',
      'annual_price',
      'overage_rate',
      'admin_seats',
      'team_seats',
      'trial_days',
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
