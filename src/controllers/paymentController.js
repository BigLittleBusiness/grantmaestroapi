import asyncHandler from '../middlewares/async.js'
import base from '../models/base.js'
import sendEmail from '../utils/mailHelper.js'
import { getActivePaymentProvider, getStripeConfiguration } from '../utils/systemSettings.js'
import {
  BILLING_INTERVAL,
  isBillingInterval,
  normaliseBillingInterval,
} from '../utils/subscriptionBilling.js'
import {
  MAX_EXTRA_SEATS,
  RENEWAL_GRACE_DAYS,
  STRIPE_PLATFORM,
  assertGstCollectionReady,
  createStripeClient,
  ensurePromoCoupon,
  getExtraSeatQuantity,
  getInvoiceSubscriptionId,
  getSubscriptionPeriodEnd,
  getSubscriptionPeriodStart,
  isSeatPrice,
  resolvePlanPrices,
  toSydneyDateOnly,
} from '../utils/stripeBilling.js'

const { Op, User, SubscriptionPlans, PromoCode } = base

// Stripe subscription statuses that grant access to GrantMaestro.
const ACCESS_STATUSES = ['active', 'trialing', 'past_due']
// Statuses that end access. "incomplete" is ignored: the first payment has not succeeded yet.
const ENDED_STATUSES = ['canceled', 'unpaid', 'incomplete_expired', 'paused']

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

const getEnabledStripe = async () => {
  const config = await getStripeConfiguration()
  if (!config.enabled || !config.secretKey) return { config, stripe: null }
  return { config, stripe: createStripeClient(config.secretKey) }
}

const isGrantMaestroObject = (object) => object?.metadata?.platform === STRIPE_PLATFORM

/** Returns the user's Stripe customer, creating it (or replacing a deleted one) as needed. */
const getOrCreateCustomer = async (stripe, user) => {
  if (user.stripe_customer_id) {
    try {
      const customer = await stripe.customers.retrieve(user.stripe_customer_id)
      if (!customer.deleted) return customer
    } catch (error) {
      if (error?.statusCode !== 404) throw error
    }
  }
  const customer = await stripe.customers.create({
    email: user.email,
    name: [user.first_name, user.last_name].filter(Boolean).join(' ') || undefined,
    metadata: {
      platform: STRIPE_PLATFORM,
      user_id: String(user.user_id),
      organization_id: String(user.organization_id || ''),
    },
  })
  await User.update(
    { stripe_customer_id: customer.id, modified_at: new Date() },
    { where: { user_id: user.user_id } }
  )
  return customer
}

const hasLiveSubscription = async (stripe, subscriptionId) => {
  if (!subscriptionId) return false
  try {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId)
    return ACCESS_STATUSES.includes(subscription.status)
  } catch (error) {
    if (error?.statusCode === 404) return false
    throw error
  }
}

const sendActivationEmail = async (user, plan, subscription) => {
  if (!user?.email) return
  const invoice = typeof subscription.latest_invoice === 'object' ? subscription.latest_invoice : null
  const interval = subscription.items?.data?.find((item) => !isSeatPrice(item.price))?.price?.recurring?.interval
  const periodEnd = getSubscriptionPeriodEnd(subscription)
  await sendEmail(user.email, 'Payment Successful — GrantMaestro', 'paymentSuccess', {
    name: user.first_name || 'there',
    orgName: user.organization_name || 'your organisation',
    planName: plan?.plan_name || 'GrantMaestro',
    amount: invoice ? (invoice.total / 100).toFixed(2) : '',
    billingInterval: interval === BILLING_INTERVAL.YEAR ? 'Annual — two months free' : 'Monthly',
    renewalDate: periodEnd ? new Date(periodEnd * 1000).toLocaleDateString('en-AU', { timeZone: 'Australia/Sydney' }) : '',
    transactionRef: invoice?.number || invoice?.id || subscription.id,
    dashboardUrl: `${process.env.FRONTEND_URL}/dashboard`,
    loginUrl: `${process.env.FRONTEND_URL}/login`,
    supportUrl: `${process.env.FRONTEND_URL}/contact?topic=support`,
    recipientEmail: user.email,
    email: user.email,
    year: new Date().getFullYear(),
  })
}

/**
 * Mirrors a Stripe subscription onto the paying user and their organisation.
 * Safe to call repeatedly (webhook retries, success-page confirmation): the
 * activation email is only sent the first time a subscription is recorded.
 */
const syncStripeSubscription = async (subscription) => {
  if (!isGrantMaestroObject(subscription)) return null
  if (!ACCESS_STATUSES.includes(subscription.status) && !ENDED_STATUSES.includes(subscription.status)) {
    return null
  }

  const userId = Number(subscription.metadata.user_id)
  const user = userId
    ? await User.findOne({ where: { user_id: userId, is_deleted: 0 } })
    : null
  if (!user) {
    console.error(`[stripe] Subscription ${subscription.id} references unknown user ${subscription.metadata.user_id}`)
    return null
  }

  const hasAccess = ACCESS_STATUSES.includes(subscription.status)
  const now = new Date()

  if (!hasAccess) {
    // Only end access when this is the subscription currently on record.
    // Login is gated on the expiry date, so it is brought forward to the day
    // the subscription ended (e.g. an immediate cancellation or failed renewal).
    if (user.stripe_subscription_id === subscription.id) {
      const endedOn = toSydneyDateOnly(subscription.ended_at || Math.floor(now.getTime() / 1000))
      const organisationUsers = user.organization_id
        ? { organization_id: user.organization_id, is_deleted: 0 }
        : { user_id: user.user_id }
      await User.update(
        { subscription_status: false, modified_at: now },
        { where: organisationUsers }
      )
      await User.update(
        { subscription_expiry_date: endedOn },
        { where: { ...organisationUsers, subscription_expiry_date: { [Op.gt]: endedOn } } }
      )
    }
    return { user, hasAccess }
  }

  const planId = Number(subscription.metadata.plan_id) || user.subscription_plan_id
  const planItem = subscription.items?.data?.find((item) => !isSeatPrice(item.price))
  const interval = normaliseBillingInterval(planItem?.price?.recurring?.interval || subscription.metadata.billing_interval)
  const periodEnd = getSubscriptionPeriodEnd(subscription)
  const periodStart = getSubscriptionPeriodStart(subscription)
  // Stripe advances the period even when a renewal fails (past_due), so only a
  // paid-up subscription extends access; otherwise the existing grace applies.
  const extendsAccess = ['active', 'trialing'].includes(subscription.status)
  const expiryDate = periodEnd && extendsAccess ? toSydneyDateOnly(periodEnd, RENEWAL_GRACE_DAYS) : null

  // Atomically claim the subscription so concurrent webhook and success-page
  // syncs send exactly one activation email.
  const [claimed] = await User.update(
    { stripe_subscription_id: subscription.id },
    {
      where: {
        user_id: user.user_id,
        [Op.or]: [
          { stripe_subscription_id: null },
          { stripe_subscription_id: { [Op.ne]: subscription.id } },
        ],
      },
    }
  )

  await User.update(
    {
      preferred_subscription_plan_id: planId,
      preferred_subscription_billing_interval: interval,
      subscription_plan_id: planId,
      subscription_billing_interval: interval,
      subscription_status: true,
      subscription_is_in_trial: false,
      ...(extendsAccess && { subscription_renewal_date: periodStart ? toSydneyDateOnly(periodStart) : now }),
      ...(expiryDate && { subscription_expiry_date: expiryDate }),
      stripe_customer_id: typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id,
      modified_at: now,
    },
    { where: { user_id: user.user_id } }
  )

  // Team members share the organisation's subscription period.
  if (user.organization_id && expiryDate) {
    await User.update(
      { subscription_status: true, subscription_expiry_date: expiryDate, modified_at: now },
      {
        where: {
          organization_id: user.organization_id,
          user_id: { [Op.ne]: user.user_id },
          is_deleted: 0,
        },
      }
    )
  }

  if (claimed > 0) {
    const plan = await SubscriptionPlans.findOne({ where: { plan_id: planId } })
    try {
      await sendActivationEmail(user, plan, subscription)
    } catch (error) {
      console.error('[stripe] Activation email failed:', error.message)
    }
  }
  return { user, hasAccess }
}

const retrieveSubscription = (stripe, subscriptionId) => stripe.subscriptions.retrieve(subscriptionId, {
  expand: ['latest_invoice'],
})

/**
 * Number of extra seats the organisation has purchased on its Stripe
 * subscription. Returns 0 when Stripe is not in use or cannot be reached.
 */
export const getPurchasedExtraSeats = async (organizationId) => {
  if (!organizationId) return 0
  try {
    const { stripe } = await getEnabledStripe()
    if (!stripe) return 0
    const payer = await User.findOne({
      where: {
        organization_id: organizationId,
        is_deleted: 0,
        stripe_subscription_id: { [Op.ne]: null, [Op.notIn]: [''] },
      },
      order: [['modified_at', 'DESC']],
    })
    if (!payer) return 0
    const subscription = await stripe.subscriptions.retrieve(payer.stripe_subscription_id)
    return ACCESS_STATUSES.includes(subscription.status) ? getExtraSeatQuantity(subscription) : 0
  } catch (error) {
    console.error('[stripe] Unable to read purchased seats:', error.message)
    return 0
  }
}

export const getPaymentProvider = asyncHandler(async (_req, res) => {
  const provider = await getActivePaymentProvider()
  return res.status(200).json({
    status: true,
    data: { provider, stripe_enabled: provider === 'stripe' },
  })
})

export const createCheckoutSession = asyncHandler(async (req, res) => {
  const { preferred_plan_id, promo_code, billing_interval } = req.body
  const extraSeats = Number(req.body.extra_seats ?? 0)

  if (!preferred_plan_id) {
    return res.status(400).json({ status: false, message: 'Please select a subscription plan.' })
  }
  if (!isBillingInterval(billing_interval)) {
    return res.status(422).json({ status: false, message: 'Please select monthly or annual billing.' })
  }
  if (!Number.isInteger(extraSeats) || extraSeats < 0 || extraSeats > MAX_EXTRA_SEATS) {
    return res.status(422).json({ status: false, message: `Extra seats must be a whole number between 0 and ${MAX_EXTRA_SEATS}.` })
  }

  const { config, stripe } = await getEnabledStripe()
  if (!stripe) {
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

  const interval = normaliseBillingInterval(billing_interval)
  let prices
  try {
    prices = await resolvePlanPrices(stripe, plan, interval, config.currency)
  } catch (error) {
    console.error('[stripe] Price configuration error:', error.message)
    return res.status(503).json({
      status: false,
      message: 'This plan is not available for online payment yet. Please contact support.',
    })
  }

  const user = await User.findOne({ where: { user_id: req.user.user_id, is_deleted: 0 } })
  if (await hasLiveSubscription(stripe, user.stripe_subscription_id)) {
    return res.status(409).json({
      status: false,
      message: 'Your organisation already has an active subscription. Please contact support to change your plan or seats.',
    })
  }

  try {
    await assertGstCollectionReady(stripe, config.secretKey)
  } catch (error) {
    console.error('[stripe] GST collection is not configured:', error.message)
    return res.status(503).json({
      status: false,
      message: 'Online payment is temporarily unavailable. Please contact support.',
    })
  }

  const customer = await getOrCreateCustomer(stripe, user)

  const metadata = {
    platform: STRIPE_PLATFORM,
    user_id: String(user.user_id),
    organization_id: String(user.organization_id || ''),
    plan_id: String(plan.plan_id),
    billing_interval: interval,
    extra_seats: String(extraSeats),
  }

  const lineItems = [{ price: prices.planPrice.id, quantity: 1 }]
  if (extraSeats > 0) {
    lineItems.push({ price: prices.seatPrice.id, quantity: extraSeats })
  }

  const checkoutOptions = {
    mode: 'subscription',
    customer: customer.id,
    client_reference_id: String(user.user_id),
    line_items: lineItems,
    // Stripe Tax adds 10% GST for Australian billing addresses (prices are
    // GST-exclusive), so the billing address is always collected.
    automatic_tax: { enabled: true },
    billing_address_collection: 'required',
    customer_update: { address: 'auto', name: 'auto' },
    tax_id_collection: { enabled: true },
    metadata,
    subscription_data: { metadata },
    success_url: `${process.env.FRONTEND_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.FRONTEND_URL}/payment/cancel`,
  }

  if (promo) {
    const coupon = await ensurePromoCoupon(stripe, promo, config.currency)
    checkoutOptions.discounts = [{ coupon: coupon.id }]
  }

  const session = await stripe.checkout.sessions.create(checkoutOptions)
  return res.status(200).json({
    status: true,
    message: 'Secure Stripe checkout session created.',
    data: { url: session.url, id: session.id },
  })
})

/**
 * GET /v1/subscription/checkout-session/:sessionId
 * Confirms a completed checkout for the success page. Activation does not
 * depend on the webhook arriving first; both paths are idempotent.
 */
export const confirmCheckoutSession = asyncHandler(async (req, res) => {
  const { sessionId } = req.params
  if (!/^cs_(test|live)_[A-Za-z0-9]+$/.test(String(sessionId))) {
    return res.status(400).json({ status: false, message: 'Invalid checkout session.' })
  }

  const { stripe } = await getEnabledStripe()
  if (!stripe) {
    return res.status(503).json({ status: false, message: 'Stripe checkout is not enabled.' })
  }

  let session
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription', 'subscription.latest_invoice'],
    })
  } catch (error) {
    if (error?.statusCode === 404) {
      return res.status(404).json({ status: false, message: 'Checkout session not found.' })
    }
    throw error
  }

  if (!isGrantMaestroObject(session) || Number(session.metadata.user_id) !== Number(req.user.user_id)) {
    return res.status(404).json({ status: false, message: 'Checkout session not found.' })
  }

  const paid = session.status === 'complete'
    && ['paid', 'no_payment_required'].includes(session.payment_status)
  const subscription = typeof session.subscription === 'object' ? session.subscription : null
  if (paid && subscription) await syncStripeSubscription(subscription)

  const plan = await SubscriptionPlans.findOne({ where: { plan_id: Number(session.metadata.plan_id) } })
  const invoice = typeof subscription?.latest_invoice === 'object' ? subscription.latest_invoice : null
  const periodEnd = getSubscriptionPeriodEnd(subscription)

  return res.status(200).json({
    status: true,
    data: {
      paid,
      session_status: session.status,
      plan_name: plan?.plan_name || null,
      billing_interval: session.metadata.billing_interval,
      extra_seats: Number(session.metadata.extra_seats || 0),
      currency: session.currency,
      amount_subtotal: session.amount_subtotal / 100,
      amount_discount: (session.total_details?.amount_discount || 0) / 100,
      amount_tax: (session.total_details?.amount_tax || 0) / 100,
      amount_total: session.amount_total / 100,
      billing_country: session.customer_details?.address?.country || null,
      next_renewal: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
      invoice_url: invoice?.hosted_invoice_url || null,
      invoice_pdf: invoice?.invoice_pdf || null,
    },
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

  const stripe = createStripeClient(stripeConfig.secretKey)
  let event
  try {
    event = stripe.webhooks.constructEvent(req.body, signature, stripeConfig.webhookSecret)
  } catch (error) {
    return res.status(400).json({ status: false, message: `Invalid Stripe webhook: ${error.message}` })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded': {
        const session = event.data.object
        const paid = ['paid', 'no_payment_required'].includes(session.payment_status)
        if (isGrantMaestroObject(session) && session.mode === 'subscription' && paid && session.subscription) {
          await syncStripeSubscription(await retrieveSubscription(stripe, session.subscription))
        }
        break
      }
      case 'invoice.paid': {
        // Renewals: extends access to the new period end.
        const subscriptionId = getInvoiceSubscriptionId(event.data.object)
        if (subscriptionId) await syncStripeSubscription(await retrieveSubscription(stripe, subscriptionId))
        break
      }
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        await syncStripeSubscription(event.data.object)
        break
      default:
        break
    }
  } catch (error) {
    console.error(`[stripe-webhook] ${event.type} processing failed:`, error.message)
    return res.status(500).json({ status: false, message: 'Webhook processing failed.' })
  }

  return res.status(200).json({ status: true, received: true })
})
