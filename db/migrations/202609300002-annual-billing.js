import { addColumnIfMissing } from './helpers.js'

/** Billing interval columns; annual price is always ten monthly payments. */
export const up = async ({ connection }) => {
  await addColumnIfMissing(connection, 'grant_users', 'preferred_subscription_billing_interval',
    "ENUM('month', 'year') NULL AFTER preferred_subscription_plan_id")
  await addColumnIfMissing(connection, 'grant_users', 'subscription_billing_interval',
    "ENUM('month', 'year') NULL AFTER subscription_plan_id")
  await connection.query(`
    UPDATE grant_subscription_plans
    SET annual_price = ROUND(plan_price * 10, 2), modified_at = NOW()
    WHERE is_deleted = 0 AND annual_price <> ROUND(plan_price * 10, 2)
  `)
}
