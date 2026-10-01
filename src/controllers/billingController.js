/**
 * billingController.js
 *
 * The Organisation Admin's view of their subscription after checkout:
 *   GET  /v1/subscription/subscription-details  plan, status, seats, next charge, invoices
 *   POST /v1/subscription/change-plan           preview or apply a plan / interval / seat change
 *   POST /v1/subscription/billing-portal        Stripe customer portal (card, invoices, cancel)
 */
import asyncHandler from '../middlewares/async.js'
import base from '../models/base.js'
import { getActivePaymentProvider } from '../utils/systemSettings.js'
import { isBillingInterval, normaliseBillingInterval } from '../utils/subscriptionBilling.js'
import { isSubscriptionExpired } from '../utils/subscriptionAccess.js'
import {
  MAX_EXTRA_SEATS,
  ensureBillingPortalConfiguration,
  getExtraSeatQuantity,
  getInvoiceTax,
  getSubscriptionPeriodEnd,
  isSeatPrice,
  resolvePlanPrices,
} from '../utils/stripeBilling.js'
import {
  ACCESS_STATUSES,
  findOrganisationPayer,
  getEnabledStripe,
  getOrganisationSubscription,
  retrieveSubscription,
  syncStripeSubscription,
} from './paymentController.js'

const { User, SubscriptionPlans } = base

const toAmount = (cents) => Number(cents || 0) / 100
const toIsoDate = (unixSeconds) => (unixSeconds ? new Date(unixSeconds * 1000).toISOString() : null)
const includedSeats = (plan) => Number(plan?.admin_seats || 0) + Number(plan?.team_seats || 0)

const countOrganisationUsers = (user) => User.count({
  where: user.organization_id
    ? { organization_id: user.organization_id, is_deleted: 0 }
    : { user_id: user.user_id, is_deleted: 0 },
})

const describeInvoice = (invoice) => ({
  id: invoice.id,
  number: invoice.number,
  date: toIsoDate(invoice.created),
  status: invoice.status,
  subtotal: toAmount(invoice.subtotal),
  tax: toAmount(getInvoiceTax(invoice)),
  total: toAmount(invoice.total),
  currency: invoice.currency,
  hosted_invoice_url: invoice.hosted_invoice_url || null,
  invoice_pdf: invoice.invoice_pdf || null,
})

const describeCard = (paymentMethod) => (paymentMethod?.card
  ? {
      brand: paymentMethod.card.brand,
      last4: paymentMethod.card.last4,
      exp_month: paymentMethod.card.exp_month,
      exp_year: paymentMethod.card.exp_year,
    }
  : null)

/** Stripe details of the organisation's subscription for the Subscription page. */
const describeStripeSubscription = async (stripe, subscription) => {
  const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id
  const [upcoming, invoices] = await Promise.all([
    ['active', 'trialing', 'past_due'].includes(subscription.status) && !subscription.cancel_at_period_end
      ? stripe.invoices.createPreview({ customer: customerId, subscription: subscription.id }).catch(() => null)
      : null,
    stripe.invoices.list({ customer: customerId, limit: 12 }),
  ])
  const planItem = subscription.items.data.find((item) => !isSeatPrice(item.price))

  return {
    id: subscription.id,
    status: subscription.status,
    billing_interval: planItem?.price?.recurring?.interval || null,
    extra_seats: getExtraSeatQuantity(subscription),
    current_period_end: toIsoDate(getSubscriptionPeriodEnd(subscription)),
    cancel_at_period_end: Boolean(subscription.cancel_at_period_end),
    cancel_at: toIsoDate(subscription.cancel_at),
    next_invoice: upcoming
      ? {
          date: toIsoDate(upcoming.next_payment_attempt || upcoming.period_end),
          subtotal: toAmount(upcoming.subtotal),
          tax: toAmount(getInvoiceTax(upcoming)),
          total: toAmount(upcoming.total),
          currency: upcoming.currency,
        }
      : null,
    payment_method: describeCard(subscription.default_payment_method)
      || describeCard(subscription.customer?.invoice_settings?.default_payment_method),
    invoices: invoices.data.filter((invoice) => invoice.status !== 'draft').map(describeInvoice),
    can_change_plan: ['active', 'trialing'].includes(subscription.status) && !subscription.cancel_at_period_end,
  }
}

export const getSubscriptionDetails = asyncHandler(async (req, res) => {
  const user = req.user
  const [provider, seatsUsed] = await Promise.all([getActivePaymentProvider(), countOrganisationUsers(user)])
  const plan = await SubscriptionPlans.findOne({
    where: { plan_id: user.subscription_plan_id || user.preferred_subscription_plan_id || 0, is_deleted: 0 },
  })

  let stripeDetails = null
  if (provider === 'stripe') {
    const { stripe } = await getEnabledStripe()
    const subscription = await getOrganisationSubscription(stripe, user, [
      'default_payment_method',
      'customer.invoice_settings.default_payment_method',
    ])
    if (subscription) stripeDetails = await describeStripeSubscription(stripe, subscription)
  }

  return res.json({
    status: true,
    data: {
      provider,
      plan: plan
        ? {
            plan_id: plan.plan_id,
            plan_name: plan.plan_name,
            admin_seats: plan.admin_seats,
            team_seats: plan.team_seats,
            included_seats: includedSeats(plan),
          }
        : null,
      billing_interval: user.subscription_billing_interval || user.preferred_subscription_billing_interval || null,
      in_trial: Boolean(user.subscription_is_in_trial),
      expiry_date: user.subscription_expiry_date,
      expired: isSubscriptionExpired(user),
      seats_used: seatsUsed,
      stripe: stripeDetails,
    },
  })
})

/**
 * POST /v1/subscription/change-plan
 * Body: { plan_id, billing_interval, extra_seats, confirm }
 * Without `confirm` it returns what would be charged now (prorated, incl. GST);
 * with `confirm: true` it applies the change only if that payment succeeds.
 */
export const changeSubscriptionPlan = asyncHandler(async (req, res) => {
  const { plan_id, billing_interval, confirm } = req.body
  const extraSeats = Number(req.body.extra_seats ?? 0)
  if (!isBillingInterval(billing_interval)) {
    return res.status(422).json({ status: false, message: 'Please select monthly or annual billing.' })
  }
  if (!Number.isInteger(extraSeats) || extraSeats < 0 || extraSeats > MAX_EXTRA_SEATS) {
    return res.status(422).json({ status: false, message: `Extra seats must be a whole number between 0 and ${MAX_EXTRA_SEATS}.` })
  }

  const { config, stripe } = await getEnabledStripe()
  if (!stripe) {
    return res.status(503).json({ status: false, message: 'Online billing is not available. Please contact support.' })
  }
  const subscription = await getOrganisationSubscription(stripe, req.user)
  if (!subscription || !ACCESS_STATUSES.includes(subscription.status)) {
    return res.status(409).json({ status: false, message: 'Your organisation has no active subscription to change.' })
  }
  if (subscription.status === 'past_due') {
    return res.status(409).json({ status: false, message: 'Your last payment failed. Update your payment method in Manage billing first.' })
  }
  if (subscription.cancel_at_period_end) {
    return res.status(409).json({ status: false, message: 'Your subscription is set to cancel. Renew it in Manage billing before changing plans.' })
  }

  const plan = await SubscriptionPlans.findOne({ where: { plan_id, is_deleted: 0, is_blocked: 0 } })
  if (!plan) {
    return res.status(404).json({ status: false, message: 'Subscription plan not found.' })
  }

  const seatsUsed = await countOrganisationUsers(req.user)
  const seatsAvailable = includedSeats(plan) + extraSeats
  if (seatsAvailable < seatsUsed) {
    return res.status(422).json({
      status: false,
      message: `Your organisation has ${seatsUsed} users. ${plan.plan_name} includes ${includedSeats(plan)} seats, so add at least ${seatsUsed - includedSeats(plan)} extra seat(s) or remove users first.`,
    })
  }

  const interval = normaliseBillingInterval(billing_interval)
  let prices
  try {
    prices = await resolvePlanPrices(stripe, plan, interval, config.currency)
  } catch (error) {
    console.error('[stripe] Price configuration error:', error.message)
    return res.status(503).json({ status: false, message: 'This plan is not available for online payment yet. Please contact support.' })
  }

  const planItem = subscription.items.data.find((item) => !isSeatPrice(item.price))
  const seatItem = subscription.items.data.find((item) => isSeatPrice(item.price))
  const unchanged = planItem?.price.id === prices.planPrice.id
    && (seatItem ? seatItem.price.id === prices.seatPrice.id && seatItem.quantity === extraSeats : extraSeats === 0)
  if (unchanged) {
    return res.status(422).json({ status: false, message: 'This is already your current plan and seat count.' })
  }

  const items = [{ id: planItem.id, price: prices.planPrice.id, quantity: 1 }]
  if (seatItem) {
    items.push(extraSeats > 0
      ? { id: seatItem.id, price: prices.seatPrice.id, quantity: extraSeats }
      : { id: seatItem.id, deleted: true })
  } else if (extraSeats > 0) {
    items.push({ price: prices.seatPrice.id, quantity: extraSeats })
  }
  const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id
  const recurringSubtotal = toAmount(prices.planPrice.unit_amount + prices.seatPrice.unit_amount * extraSeats)

  if (!confirm) {
    // Upgrades are charged now (prorated); downgrades become account credit.
    const preview = await stripe.invoices.createPreview({
      customer: customerId,
      subscription: subscription.id,
      subscription_details: { items, proration_behavior: 'always_invoice' },
    })
    return res.json({
      status: true,
      data: {
        plan_name: plan.plan_name,
        billing_interval: interval,
        extra_seats: extraSeats,
        currency: preview.currency,
        due_now: {
          subtotal: toAmount(preview.subtotal),
          tax: toAmount(getInvoiceTax(preview)),
          total: toAmount(preview.total),
        },
        recurring_subtotal: recurringSubtotal,
      },
    })
  }

  let updated
  try {
    updated = await stripe.subscriptions.update(subscription.id, {
      items,
      proration_behavior: 'always_invoice',
      // The change only takes effect if its payment succeeds.
      payment_behavior: 'pending_if_incomplete',
      expand: ['latest_invoice'],
    })
  } catch (error) {
    if (error?.type === 'StripeCardError') {
      return res.status(402).json({ status: false, message: `${error.message} Your plan has not been changed.` })
    }
    throw error
  }
  if (updated.pending_update) {
    return res.status(402).json({
      status: false,
      message: 'The payment for this change could not be completed, so your plan has not been changed. Please update your payment method in Manage billing and try again.',
      data: { invoice_url: updated.latest_invoice?.hosted_invoice_url || null },
    })
  }

  await stripe.subscriptions.update(subscription.id, {
    metadata: { plan_id: String(plan.plan_id), billing_interval: interval, extra_seats: String(extraSeats) },
  })
  await syncStripeSubscription(await retrieveSubscription(stripe, subscription.id))

  return res.json({ status: true, message: `Your subscription is now ${plan.plan_name} (${interval === 'year' ? 'annual' : 'monthly'}) with ${extraSeats} extra seat(s).` })
})

/** POST /v1/subscription/billing-portal: returns a Stripe customer portal URL. */
export const createBillingPortalSession = asyncHandler(async (req, res) => {
  const { config, stripe } = await getEnabledStripe()
  if (!stripe) {
    return res.status(503).json({ status: false, message: 'Online billing is not available. Please contact support.' })
  }
  const payer = await findOrganisationPayer(req.user)
  const customerId = payer?.stripe_customer_id || req.user.stripe_customer_id
  if (!customerId) {
    return res.status(404).json({ status: false, message: 'Your organisation has no billing account yet. Subscribe first.' })
  }
  const configuration = await ensureBillingPortalConfiguration(stripe, config.secretKey)
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    configuration: configuration.id,
    return_url: `${process.env.FRONTEND_URL}/subscription`,
  })
  return res.json({ status: true, data: { url: session.url } })
})
