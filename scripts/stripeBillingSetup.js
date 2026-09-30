/**
 * stripeBillingSetup.js
 *
 * Links the GrantMaestro products in Stripe to the application. Run once per
 * environment (test and live) after saving the Stripe keys in System Admin →
 * Payment Settings, and again whenever prices change in Stripe:
 *
 *   node scripts/stripeBillingSetup.js            # apply
 *   node scripts/stripeBillingSetup.js --dry-run  # report only
 *
 * It is idempotent and:
 *   1. Finds the active recurring prices of the products named
 *      "GrantMaestro <Starter|Professional|Enterprise> - <Monthly|Yearly>[ extra seat]"
 *      and assigns lookup keys (grantmaestro_<plan>_[seat_]<month|year>).
 *   2. Marks those prices as GST-exclusive, so GST is added on top.
 *   3. Checks Stripe Tax is active with an Australian (GST) registration.
 *      In test mode a missing registration is created; in live mode it must
 *      be added in Stripe Dashboard → Tax → Registrations (it is a legal
 *      declaration against the business ABN), and the script stops.
 *   4. Updates grant_subscription_plans so displayed prices match Stripe.
 *
 * The secret key is read from grant_system_settings, or STRIPE_SECRET_KEY if set.
 */
import '../src/env.js'
import mysql from 'mysql2/promise'
import { decryptSetting } from '../src/utils/settingsCrypto.js'
import {
  PLAN_KEYS,
  STRIPE_PLATFORM,
  GST_COUNTRY,
  createStripeClient,
  findGstRegistration,
  normalisePlanKey,
  planLookupKey,
  seatLookupKey,
} from '../src/utils/stripeBilling.js'

const dryRun = process.argv.includes('--dry-run')
const PRODUCT_NAME_PATTERN = /^GrantMaestro\s+(Starter|Professional|Pro|Enterprise)\s*-\s*(Monthly|Yearly)(\s+extra\s+seat)?$/i
const INTERVALS = { monthly: 'month', yearly: 'year' }

const connection = await mysql.createConnection({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
})

const readSetting = async (key) => {
  const [rows] = await connection.query(
    'SELECT setting_value, is_encrypted FROM grant_system_settings WHERE setting_key = ? AND is_deleted = 0',
    [key]
  )
  if (!rows.length || !rows[0].setting_value) return null
  return rows[0].is_encrypted ? decryptSetting(rows[0].setting_value) : rows[0].setting_value
}

const fail = (message) => {
  console.error(`\n✖ ${message}`)
  process.exitCode = 1
}

try {
  const secretKey = process.env.STRIPE_SECRET_KEY || await readSetting('stripe_secret_key')
  if (!secretKey) throw new Error('No Stripe secret key found. Save it in System Admin → Payment Settings first.')
  const currency = (await readSetting('stripe_currency') || 'AUD').toLowerCase()
  const stripe = createStripeClient(secretKey)
  console.log(`Stripe ${secretKey.startsWith('sk_live_') ? 'LIVE' : 'TEST'} mode, currency ${currency.toUpperCase()}${dryRun ? ' (dry run)' : ''}\n`)

  // 1. Map active prices to lookup keys.
  const pricesByKey = {}
  for await (const price of stripe.prices.list({ active: true, type: 'recurring', expand: ['data.product'], limit: 100 })) {
    const product = price.product
    if (!product?.active) continue
    const match = PRODUCT_NAME_PATTERN.exec(String(product.name).trim())
    if (!match) continue

    const plan = normalisePlanKey(match[1])
    const interval = INTERVALS[match[2].toLowerCase()]
    const prefix = `grantmaestro_${plan}`
    const key = match[3] ? seatLookupKey(prefix, interval) : planLookupKey(prefix, interval)

    if (price.recurring.interval !== interval || price.recurring.interval_count !== 1) {
      fail(`${product.name} (${price.id}) bills every ${price.recurring.interval_count} ${price.recurring.interval}, expected 1 ${interval}.`)
      continue
    }
    if (price.currency !== currency) {
      fail(`${product.name} (${price.id}) is in ${price.currency.toUpperCase()}, expected ${currency.toUpperCase()}.`)
      continue
    }
    if (pricesByKey[key]) {
      fail(`Both ${pricesByKey[key].id} and ${price.id} match "${key}". Archive the price that should not be used.`)
      continue
    }
    pricesByKey[key] = price
  }

  for (const [key, price] of Object.entries(pricesByKey).sort()) {
    const update = {}
    if (price.lookup_key !== key) {
      update.lookup_key = key
      update.transfer_lookup_key = true
    }
    if (price.metadata?.platform !== STRIPE_PLATFORM) update.metadata = { platform: STRIPE_PLATFORM }
    // 2. GST is added on top of the listed price.
    if (price.tax_behavior === 'unspecified') update.tax_behavior = 'exclusive'
    if (price.tax_behavior === 'inclusive') {
      console.warn(`⚠ ${price.id} is marked tax-inclusive in Stripe; GST will still be added on top by the GST tax rate.`)
    }

    const amount = (price.unit_amount / 100).toFixed(2)
    const changes = Object.keys(update).filter((field) => field !== 'transfer_lookup_key')
    console.log(`${key.padEnd(34)} ${price.id}  $${amount.padStart(9)}  ${changes.length ? `update: ${changes.join(', ')}` : 'ok'}`)
    if (changes.length && !dryRun) await stripe.prices.update(price.id, update)
  }

  const missingKeys = PLAN_KEYS.flatMap((plan) => ['month', 'year'].flatMap((interval) => [
    planLookupKey(`grantmaestro_${plan}`, interval),
    seatLookupKey(`grantmaestro_${plan}`, interval),
  ])).filter((key) => !pricesByKey[key])
  if (missingKeys.length) fail(`Missing Stripe prices: ${missingKeys.join(', ')}`)

  // 3. GST collection through Stripe Tax.
  const liveMode = secretKey.startsWith('sk_live_')
  const taxSettings = await stripe.tax.settings.retrieve()
  if (taxSettings.status !== 'active') {
    fail(`Stripe Tax is not active (status: ${taxSettings.status}). Complete Stripe Dashboard → Tax → Settings (head office address and default tax behaviour).`)
  }
  let registration = await findGstRegistration(stripe)
  if (!registration && !liveMode && !dryRun) {
    registration = await stripe.tax.registrations.create({
      country: GST_COUNTRY,
      country_options: { au: { type: 'standard' } },
      active_from: 'now',
    })
  }
  if (registration) {
    console.log(`\nGST: Stripe Tax registration ${registration.id} (${registration.country}, ${registration.status})`)
  } else if (dryRun && !liveMode) {
    console.log('\nGST: no Australian registration yet; it will be created when applied (test mode)')
  } else {
    fail('No active Australian registration in Stripe Tax. Add it in Stripe Dashboard → Tax → Registrations → Australia; checkout stays disabled until then.')
  }

  // 4. Keep the plan table's displayed prices in line with Stripe.
  console.log('\nSubscription plans:')
  const [plans] = await connection.query(
    'SELECT plan_id, plan_name, plan_price, annual_price, overage_rate, stripe_plan_id FROM grant_subscription_plans WHERE is_deleted = 0 ORDER BY plan_id'
  )
  const linkedPlans = new Set()
  for (const plan of plans) {
    const key = normalisePlanKey(plan.plan_name)
    if (!key) {
      console.log(`  #${plan.plan_id} ${plan.plan_name}: not a Starter/Pro/Enterprise plan, left unchanged`)
      continue
    }
    const prefix = `grantmaestro_${key}`
    const monthly = pricesByKey[planLookupKey(prefix, 'month')]
    const yearly = pricesByKey[planLookupKey(prefix, 'year')]
    const seatMonthly = pricesByKey[seatLookupKey(prefix, 'month')]
    if (!monthly || !yearly || !seatMonthly) {
      fail(`Plan #${plan.plan_id} ${plan.plan_name} has no complete set of Stripe prices.`)
      continue
    }
    const values = {
      stripe_plan_id: prefix,
      plan_price: monthly.unit_amount / 100,
      annual_price: yearly.unit_amount / 100,
      overage_rate: seatMonthly.unit_amount / 100,
    }
    if (values.annual_price !== Math.round(values.plan_price * 10 * 100) / 100) {
      console.warn(`  ⚠ ${plan.plan_name}: yearly price $${values.annual_price} is not 10 × monthly $${values.plan_price}.`)
    }
    const changed = Object.entries(values).filter(([field, value]) => String(plan[field]) !== String(value) && Number(plan[field]) !== value)
    console.log(`  #${plan.plan_id} ${plan.plan_name}: $${values.plan_price}/mo, $${values.annual_price}/yr, extra seat $${values.overage_rate}/mo${changed.length ? `  (updating ${changed.map(([field]) => field).join(', ')})` : ''}`)
    if (changed.length && !dryRun) {
      await connection.query(
        'UPDATE grant_subscription_plans SET stripe_plan_id = ?, plan_price = ?, annual_price = ?, overage_rate = ?, modified_at = NOW() WHERE plan_id = ?',
        [values.stripe_plan_id, values.plan_price, values.annual_price, values.overage_rate, plan.plan_id]
      )
    }
    linkedPlans.add(key)
  }
  const unlinked = PLAN_KEYS.filter((key) => !linkedPlans.has(key))
  if (unlinked.length) fail(`No plan row for: ${unlinked.join(', ')}. Customers cannot select these plans.`)

  console.log(process.exitCode ? '\nFinished with errors.' : `\n${dryRun ? 'Dry run complete.' : 'Stripe billing setup complete.'}`)
} catch (error) {
  fail(error.message)
} finally {
  await connection.end()
}
