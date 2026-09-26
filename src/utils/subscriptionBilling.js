export const BILLING_INTERVAL = Object.freeze({
  MONTH: 'month',
  YEAR: 'year',
})

export const isBillingInterval = (value) => Object.values(BILLING_INTERVAL).includes(value)

export const normaliseBillingInterval = (value, fallback = BILLING_INTERVAL.MONTH) => (
  isBillingInterval(value) ? value : fallback
)

/**
 * Annual GrantMaestro subscriptions always charge ten monthly payments. This
 * is deliberately calculated from the monthly plan price, so an administrator
 * changing that price cannot accidentally break the two-months-free promise.
 */
export const calculateAnnualPrice = (monthlyPrice) => {
  const numericPrice = Number(monthlyPrice)
  if (!Number.isFinite(numericPrice) || numericPrice < 0) return 0
  return Math.round(numericPrice * 10 * 100) / 100
}

export const getSubscriptionPrice = (plan, billingInterval) => (
  normaliseBillingInterval(billingInterval) === BILLING_INTERVAL.YEAR
    ? calculateAnnualPrice(plan.plan_price)
    : Number(plan.plan_price)
)

export const calculateSubscriptionExpiry = (billingInterval, startDate = new Date()) => {
  const expiryDate = new Date(startDate)
  if (normaliseBillingInterval(billingInterval) === BILLING_INTERVAL.YEAR) {
    expiryDate.setFullYear(expiryDate.getFullYear() + 1)
  } else {
    expiryDate.setMonth(expiryDate.getMonth() + 1)
  }
  return expiryDate
}
