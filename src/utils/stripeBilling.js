/**
 * stripeBilling.js
 *
 * Pure Stripe helpers shared by the checkout/webhook controllers and the
 * scripts/stripeBillingSetup.js provisioning script. This module must not
 * import the Sequelize models so the setup script can use it standalone.
 *
 * Price resolution
 *   Each GrantMaestro plan maps to four recurring Stripe prices, resolved by
 *   lookup key so the same code works in test and live mode:
 *     grantmaestro_<plan>_month        grantmaestro_<plan>_year
 *     grantmaestro_<plan>_seat_month   grantmaestro_<plan>_seat_year
 *   where <plan> is starter | pro | enterprise. The plan's lookup-key prefix
 *   (e.g. "grantmaestro_pro") is stored in grant_subscription_plans.stripe_plan_id.
 *
 * GST
 *   Prices are GST-exclusive (tax_behavior "exclusive"). Checkout runs with
 *   Stripe Tax (automatic_tax), which adds 10% GST when the customer's billing
 *   address is in Australia and on every renewal. Stripe Tax only collects in
 *   countries with an active registration, so checkout refuses to start
 *   without an active Australian registration rather than silently charging
 *   no GST.
 */
import Stripe from 'stripe'

export const STRIPE_PLATFORM = 'grantmaestro'
export const MAX_EXTRA_SEATS = 200

// Days of access kept after a paid period ends, covering Stripe's renewal
// charge and its automatic retries before access lapses.
export const RENEWAL_GRACE_DAYS = 3

const PLAN_KEY_ALIASES = {
  starter: 'starter',
  pro: 'pro',
  professional: 'pro',
  enterprise: 'enterprise',
}

export const PLAN_KEYS = ['starter', 'pro', 'enterprise']
const LOOKUP_PREFIX_PATTERN = /^grantmaestro_(starter|pro|enterprise)$/

export const createStripeClient = (secretKey) => new Stripe(secretKey)

export const normalisePlanKey = (name) => PLAN_KEY_ALIASES[String(name || '').trim().toLowerCase()] || null

/** Returns the lookup-key prefix for a plan row, e.g. "grantmaestro_pro". */
export const getPlanLookupPrefix = (plan) => {
  const stored = String(plan?.stripe_plan_id || '').trim()
  if (LOOKUP_PREFIX_PATTERN.test(stored)) return stored
  const key = normalisePlanKey(plan?.plan_name)
  return key ? `grantmaestro_${key}` : null
}

export const planLookupKey = (prefix, interval) => `${prefix}_${interval}`
export const seatLookupKey = (prefix, interval) => `${prefix}_seat_${interval}`
export const isSeatPrice = (price) => /_seat_(month|year)$/.test(String(price?.lookup_key || ''))

/** The plan lookup prefix a price belongs to, e.g. "grantmaestro_pro", or null. */
export const planPrefixFromPrice = (price) => {
  const match = /^(grantmaestro_(?:starter|pro|enterprise))_(?:seat_)?(?:month|year)$/.exec(String(price?.lookup_key || ''))
  return match ? match[1] : null
}

/** Sum of the tax on an invoice or invoice preview, in cents. */
export const getInvoiceTax = (invoice) => (invoice?.total_taxes || [])
  .reduce((total, tax) => total + Number(tax.amount || 0), 0)

/**
 * Fetches the plan price and extra-seat price for a plan and billing interval.
 * Throws a descriptive error when either price is missing or misconfigured.
 */
export const resolvePlanPrices = async (stripe, plan, interval, currency) => {
  const prefix = getPlanLookupPrefix(plan)
  if (!prefix) {
    throw new Error(`Plan "${plan?.plan_name}" is not linked to Stripe prices.`)
  }
  const planKey = planLookupKey(prefix, interval)
  const seatKey = seatLookupKey(prefix, interval)
  const { data } = await stripe.prices.list({ lookup_keys: [planKey, seatKey], active: true, limit: 10 })
  const byKey = Object.fromEntries(data.map((price) => [price.lookup_key, price]))

  for (const key of [planKey, seatKey]) {
    const price = byKey[key]
    if (!price) throw new Error(`Stripe price "${key}" was not found. Run the Stripe billing setup script.`)
    if (price.recurring?.interval !== interval) throw new Error(`Stripe price "${key}" is not billed per ${interval}.`)
    if (currency && price.currency !== currency) throw new Error(`Stripe price "${key}" is in ${price.currency.toUpperCase()}, expected ${currency.toUpperCase()}.`)
  }
  return { planPrice: byKey[planKey], seatPrice: byKey[seatKey] }
}

export const GST_COUNTRY = 'AU'

/** The account's active Australian Stripe Tax registration, or null. */
export const findGstRegistration = async (stripe) => {
  for await (const registration of stripe.tax.registrations.list({ status: 'active', limit: 100 })) {
    if (registration.country === GST_COUNTRY) return registration
  }
  return null
}

const GST_READY_CACHE_MS = 10 * 60 * 1000
const gstReadyCache = new Map()

/**
 * Throws unless Stripe Tax is active with an Australian registration, so a
 * misconfigured account can never check out Australian customers without GST.
 * Positive results are cached briefly to keep checkout fast.
 */
export const assertGstCollectionReady = async (stripe, cacheKey = 'default') => {
  const checkedAt = gstReadyCache.get(cacheKey)
  if (checkedAt && Date.now() - checkedAt < GST_READY_CACHE_MS) return

  const settings = await stripe.tax.settings.retrieve()
  if (settings.status !== 'active') {
    throw new Error(`Stripe Tax is not active (status: ${settings.status}).`)
  }
  if (!await findGstRegistration(stripe)) {
    throw new Error('Stripe Tax has no active Australian (GST) registration.')
  }
  gstReadyCache.set(cacheKey, Date.now())
}

const portalConfigurationCache = new Map()

/**
 * The customer portal configuration used by GrantMaestro (created on first use):
 * payment method, billing details, invoices and cancellation at period end.
 * Plan and seat changes are made in the app instead, because the portal cannot
 * update subscriptions with more than one item (plan + extra seats).
 */
export const ensureBillingPortalConfiguration = async (stripe, cacheKey = 'default') => {
  if (portalConfigurationCache.has(cacheKey)) return portalConfigurationCache.get(cacheKey)
  let configuration = null
  for await (const candidate of stripe.billingPortal.configurations.list({ active: true, limit: 100 })) {
    if (candidate.metadata?.platform === STRIPE_PLATFORM) { configuration = candidate; break }
  }
  configuration ||= await stripe.billingPortal.configurations.create({
    business_profile: { headline: 'Manage your GrantMaestro billing' },
    features: {
      customer_update: { enabled: true, allowed_updates: ['name', 'address', 'tax_id'] },
      invoice_history: { enabled: true },
      payment_method_update: { enabled: true },
      subscription_cancel: {
        enabled: true,
        mode: 'at_period_end',
        cancellation_reason: {
          enabled: true,
          options: ['too_expensive', 'missing_features', 'switched_service', 'unused', 'other'],
        },
      },
    },
    metadata: { platform: STRIPE_PLATFORM },
  })
  portalConfigurationCache.set(cacheKey, configuration)
  return configuration
}

/**
 * Reuses one Stripe coupon per GrantMaestro promo code instead of creating a
 * new coupon on every checkout.
 */
export const ensurePromoCoupon = async (stripe, promo, currency) => {
  const couponId = `grantmaestro_promo_${promo.promo_id}`
  try {
    return await stripe.coupons.retrieve(couponId)
  } catch (error) {
    if (error?.statusCode !== 404) throw error
  }
  const options = {
    id: couponId,
    name: `GrantMaestro ${promo.code}`,
    duration: promo.duration_months > 1 ? 'repeating' : 'once',
    metadata: { platform: STRIPE_PLATFORM, promo_id: String(promo.promo_id) },
  }
  if (promo.duration_months > 1) options.duration_in_months = promo.duration_months
  if (promo.discount_type === 'percentage') options.percent_off = Number(promo.discount_value)
  else {
    options.amount_off = Math.round(Number(promo.discount_value) * 100)
    options.currency = currency
  }
  return stripe.coupons.create(options)
}

/** Latest period end (unix seconds) across a subscription's items. */
export const getSubscriptionPeriodEnd = (subscription) => {
  const itemEnds = (subscription?.items?.data || [])
    .map((item) => item.current_period_end)
    .filter(Number.isFinite)
  if (itemEnds.length) return Math.max(...itemEnds)
  return subscription?.current_period_end || null
}

export const getSubscriptionPeriodStart = (subscription) => {
  const itemStarts = (subscription?.items?.data || [])
    .map((item) => item.current_period_start)
    .filter(Number.isFinite)
  if (itemStarts.length) return Math.min(...itemStarts)
  return subscription?.current_period_start || null
}

export const getExtraSeatQuantity = (subscription) => (subscription?.items?.data || [])
  .filter((item) => isSeatPrice(item.price))
  .reduce((total, item) => total + Number(item.quantity || 0), 0)

/** Subscription id of an invoice, across old and new Stripe API shapes. */
export const getInvoiceSubscriptionId = (invoice) => {
  const id = invoice?.parent?.subscription_details?.subscription ?? invoice?.subscription
  return typeof id === 'string' ? id : id?.id || null
}

/** Formats a unix timestamp as a YYYY-MM-DD date in Australia/Sydney. */
export const toSydneyDateOnly = (unixSeconds, addDays = 0) => {
  const date = new Date((unixSeconds + addDays * 86400) * 1000)
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Sydney' }).format(date)
}
