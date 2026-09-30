// Starting values only: existing plans are never overwritten, so prices edited
// by the Platform Admin are kept. `npm run stripe:setup` syncs prices from Stripe.
// IDs match frontend/src/features/auth/Register.js (starter 1, pro 2, enterprise 3).
const PLANS = [
  // id, name, monthly, annual, extra seat per month, admin seats, team seats, Stripe lookup prefix
  [1, 'Starter', 99, 990, 20, 1, 3, 'grantmaestro_starter'],
  [2, 'Pro', 275, 2750, 18, 2, 10, 'grantmaestro_pro'],
  [3, 'Enterprise', 825, 8250, 15, 5, 20, 'grantmaestro_enterprise'],
]
const TRIAL_DAYS = 14

export const run = async ({ connection }) => {
  let added = 0
  for (const [id, name, monthly, annual, seat, adminSeats, teamSeats, stripeKey] of PLANS) {
    const [result] = await connection.query(
      `INSERT IGNORE INTO grant_subscription_plans
        (plan_id, plan_name, plan_description, plan_duration, plan_price, annual_price, overage_rate,
         admin_seats, team_seats, stripe_plan_id, trial_days, is_blocked, is_deleted, created_at, modified_at)
       VALUES (?, ?, ?, 'month', ?, ?, ?, ?, ?, ?, ?, 0, 0, NOW(), NOW())`,
      [id, name, `${name} plan`, monthly, annual, seat, adminSeats, teamSeats, stripeKey, TRIAL_DAYS]
    )
    added += result.affectedRows
  }
  return `${added} plans added`
}
