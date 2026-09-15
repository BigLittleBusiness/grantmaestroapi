import asyncHandler from '../middlewares/async.js'
import base from '../models/base.js'
import Stripe from 'stripe'
import sendEmail from '../utils/mailHelper.js'
import { getStripeConfiguration } from '../utils/systemSettings.js'

const { User, SubscriptionPlans, PromoCode } = base

const calculateExpiryDate = (plan) => {
  const expiryDate = new Date()
  if (plan.plan_duration === 'year') expiryDate.setFullYear(expiryDate.getFullYear() + 1)
  else if (plan.plan_duration === 'week') expiryDate.setDate(expiryDate.getDate() + 7)
  else if (plan.plan_duration === 'day') expiryDate.setDate(expiryDate.getDate() + 1)
  else expiryDate.setMonth(expiryDate.getMonth() + 1)
  return expiryDate
}

const validatePromo = async (code) => {
  if (!code) return null
  const promo = await PromoCode.findOne({
    where: { code: code.toUpperCase(), is_deleted: 0 },
  })
  if (!promo) throw new Error('Promo code is invalid.')
  if (promo.expires_at && new Date(promo.expires_at).setHours(0, 0, 0, 0) < new Date().setHours(0, 0, 0, 0)) {
    throw new Error('Promo code has expired.')
  }
  return promo
}

const activateSubscription = async ({ userId, planId, stripeSubscriptionId = null }) => {
  const plan = await SubscriptionPlans.findOne({ where: { plan_id: planId, is_deleted: 0 } })
  if (!plan) throw new Error('Subscription plan not found.')

  const expiryDate = calculateExpiryDate(plan)
  await User.update(
    {
      preferred_subscription_plan_id: planId,
      subscription_plan_id: planId,
      subscription_status: true,
      subscription_is_in_trial: false,
      subscription_renewal_date: new Date(),
      subscription_expiry_date: expiryDate,
      stripe_subscription_id: stripeSubscriptionId || undefined,
      modified_at: new Date(),
    },
    { where: { user_id: userId, is_deleted: 0 } }
  )

  const user = await User.findOne({ where: { user_id: userId, is_deleted: 0 } })
  if (user?.email) {
    await sendEmail(user.email, 'Payment Successful — GrantMaestro', 'paymentSuccess', {
      name: user.first_name || 'there',
      planName: plan.plan_name,
      amount: `$${Number(plan.plan_price).toFixed(2)}`,
      currency: 'AUD',
      dashboardUrl: `${process.env.FRONTEND_URL}/dashboard`,
      loginUrl: `${process.env.FRONTEND_URL}/login`,
      recipientEmail: user.email,
      year: new Date().getFullYear(),
    })
  }
  return { plan, expiryDate }
}

export const getPaymentProvider = asyncHandler(async (_req, res) => {
  const stripeConfig = await getStripeConfiguration()
  return res.status(200).json({
    status: true,
    data: {
      provider: stripeConfig.enabled && stripeConfig.secretKey ? 'stripe' : 'pin',
      stripe_enabled: stripeConfig.enabled && Boolean(stripeConfig.secretKey),
    },
  })
})

export const createCheckoutSession = asyncHandler(async (req, res) => {
  const { preferred_plan_id, promo_code } = req.body
  if (!preferred_plan_id) {
    return res.status(400).json({ status: false, message: 'Please select a subscription plan.' })
  }

  const stripeConfig = await getStripeConfiguration()
  if (!stripeConfig.enabled || !stripeConfig.secretKey) {
    return res.status(503).json({
      status: false,
      message: 'Stripe checkout is not enabled. Please contact your system administrator.',
    })
  }

  const plan = await SubscriptionPlans.findOne({
    where: { plan_id: preferred_plan_id, is_deleted: 0, is_blocked: 0 },
  })
  if (!plan) {
    return res.status(404).json({ status: false, message: 'Subscription plan not found.' })
  }

  let promo = null
  try {
    promo = await validatePromo(promo_code)
  } catch (error) {
    return res.status(422).json({ status: false, message: error.message })
  }

  const stripe = new Stripe(stripeConfig.secretKey)
  const currency = stripeConfig.currency || 'aud'
  const checkoutOptions = {
    mode: 'subscription',
    customer_email: req.user.email,
    client_reference_id: String(req.user.user_id),
    line_items: [{
      price_data: {
        currency,
        product_data: { name: `GrantMaestro ${plan.plan_name}` },
        unit_amount: Math.round(Number(plan.plan_price) * 100),
        recurring: { interval: plan.plan_duration === 'year' ? 'year' : 'month' },
      },
      quantity: 1,
    }],
    metadata: {
      user_id: String(req.user.user_id),
      plan_id: String(plan.plan_id),
      platform: 'grantmaestro',
    },
    subscription_data: {
      metadata: {
        user_id: String(req.user.user_id),
        plan_id: String(plan.plan_id),
        platform: 'grantmaestro',
      },
    },
    success_url: `${process.env.FRONTEND_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.FRONTEND_URL}/payment/cancel`,
  }

  if (promo) {
    const couponOptions = {
      duration: promo.duration_months > 1 ? 'repeating' : 'once',
      name: `GrantMaestro ${promo.code}`,
    }
    if (promo.duration_months > 1) couponOptions.duration_in_months = promo.duration_months
    if (promo.discount_type === 'percentage') couponOptions.percent_off = Number(promo.discount_value)
    else {
      couponOptions.amount_off = Math.round(Number(promo.discount_value) * 100)
      couponOptions.currency = currency
    }
    const coupon = await stripe.coupons.create(couponOptions)
    checkoutOptions.discounts = [{ coupon: coupon.id }]
  }

  const session = await stripe.checkout.sessions.create(checkoutOptions)
  return res.status(200).json({
    status: true,
    message: 'Secure Stripe checkout session created.',
    data: { url: session.url, id: session.id },
  })
})

export const paymentWebhook = asyncHandler(async (req, res) => {
  const stripeConfig = await getStripeConfiguration()
  if (!stripeConfig.secretKey || !stripeConfig.webhookSecret) {
    return res.status(503).json({ status: false, message: 'Stripe webhook is not configured.' })
  }

  const signature = req.headers['stripe-signature']
  if (!signature) {
    return res.status(400).json({ status: false, message: 'Missing Stripe signature.' })
  }

  let event
  try {
    const stripe = new Stripe(stripeConfig.secretKey)
    event = stripe.webhooks.constructEvent(req.body, signature, stripeConfig.webhookSecret)
  } catch (error) {
    return res.status(400).json({ status: false, message: `Invalid Stripe webhook: ${error.message}` })
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object
      const userId = Number(session.metadata?.user_id || session.client_reference_id)
      const planId = Number(session.metadata?.plan_id)
      if (userId && planId) {
        await activateSubscription({
          userId,
          planId,
          stripeSubscriptionId: typeof session.subscription === 'string' ? session.subscription : null,
        })
      }
    }
    if (event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object
      const userId = Number(subscription.metadata?.user_id)
      if (userId) {
        await User.update(
          { subscription_status: false, modified_at: new Date() },
          { where: { user_id: userId, is_deleted: 0 } }
        )
      }
    }
  } catch (error) {
    console.error('[stripe-webhook] Processing failed:', error.message)
    return res.status(500).json({ status: false, message: 'Webhook processing failed.' })
  }

  return res.status(200).json({ status: true, received: true })
})
