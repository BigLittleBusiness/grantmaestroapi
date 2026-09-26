import assert from 'node:assert/strict'
import {
  BILLING_INTERVAL,
  calculateAnnualPrice,
  calculateSubscriptionExpiry,
  getSubscriptionPrice,
} from '../src/utils/subscriptionBilling.js'

const plans = [
  { name: 'Starter', plan_price: 99, annual_price: 990 },
  { name: 'Pro', plan_price: 275, annual_price: 2750 },
  { name: 'Enterprise', plan_price: 625, annual_price: 6250 },
]

for (const plan of plans) {
  assert.equal(calculateAnnualPrice(plan.plan_price), plan.annual_price, `${plan.name} annual total`)
  assert.equal(getSubscriptionPrice(plan, BILLING_INTERVAL.MONTH), plan.plan_price, `${plan.name} monthly charge`)
  assert.equal(getSubscriptionPrice(plan, BILLING_INTERVAL.YEAR), plan.annual_price, `${plan.name} annual charge`)
}

const startDate = new Date('2026-01-15T12:00:00Z')
assert.equal(calculateSubscriptionExpiry(BILLING_INTERVAL.MONTH, startDate).toISOString().slice(0, 10), '2026-02-15')
assert.equal(calculateSubscriptionExpiry(BILLING_INTERVAL.YEAR, startDate).toISOString().slice(0, 10), '2027-01-15')

console.log('Annual billing smoke tests passed.')
