import '../src/env.js'
import mysql from 'mysql2/promise'

const connection = await mysql.createConnection({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
})

const addColumnIfMissing = async (table, column, definition) => {
  const [rows] = await connection.query(`SHOW COLUMNS FROM \`${table}\` LIKE ?`, [column])
  if (rows.length === 0) {
    await connection.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`)
    console.log(`Added ${table}.${column}`)
  }
}

try {
  await connection.beginTransaction()

  await addColumnIfMissing(
    'grant_users',
    'preferred_subscription_billing_interval',
    "ENUM('month', 'year') NULL AFTER preferred_subscription_plan_id"
  )
  await addColumnIfMissing(
    'grant_users',
    'subscription_billing_interval',
    "ENUM('month', 'year') NULL AFTER subscription_plan_id"
  )

  // Annual price is an annual total, not a monthly-equivalent display amount.
  // Ten paid months delivers twelve months of access.
  const [updateResult] = await connection.query(`
    UPDATE grant_subscription_plans
    SET annual_price = ROUND(plan_price * 10, 2), modified_at = NOW()
    WHERE is_deleted = 0
      AND annual_price <> ROUND(plan_price * 10, 2)
  `)

  await connection.commit()
  console.log(`Annual billing migration complete. Updated ${updateResult.affectedRows} plan price(s).`)
} catch (error) {
  await connection.rollback()
  console.error('Annual billing migration failed:', error.message)
  process.exitCode = 1
} finally {
  await connection.end()
}
