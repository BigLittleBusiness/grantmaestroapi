/**
 * seedSysAdmin.js
 *
 * Creates the GrantMaestro Super Admin (Sys Admin) account.
 * Run once on a fresh deployment:
 *   node scripts/seedSysAdmin.js
 *
 * This script is idempotent — it will not create a duplicate if the
 * email already exists.
 */
import '../src/env.js'
import bcrypt from 'bcryptjs'
import Sequelize from 'sequelize'
import { fileURLToPath } from 'url'
import path from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname  = path.dirname(__filename)

// ── DB connection ─────────────────────────────────────────────────────────────
const sequelize = new Sequelize(
  process.env.DB_NAME     || 'db_grant_maestro',
  process.env.DB_USER     || 'grantmaestro',
  process.env.DB_PASSWORD || '',
  {
    host:    process.env.DB_HOST || 'localhost',
    port:    Number(process.env.DB_PORT || 3306),
    dialect: 'mysql',
    logging: false,
  }
)

// ── Config ────────────────────────────────────────────────────────────────────
const ADMIN_EMAIL     = 'tizzbizz@gmail.com'
const ADMIN_PASSWORD  = 'GMadmin@2026!'   // ← notified to user
const ADMIN_FIRST     = 'Kristian'
const ADMIN_LAST      = 'Admin'
const SUPER_ADMIN_ROLE_ID = 2             // grant_user_roles: Super Admin

const now = new Date()

async function seed() {
  try {
    await sequelize.authenticate()
    console.log('Database connected.')

    // Check if email already exists
    const [existing] = await sequelize.query(
      `SELECT user_id FROM grant_users WHERE email = ? AND is_deleted = 0 LIMIT 1`,
      { replacements: [ADMIN_EMAIL], type: Sequelize.QueryTypes.SELECT }
    )
    if (existing) {
      console.log(`✓ Sys Admin already exists (user_id: ${existing.user_id}). No changes made.`)
      await sequelize.close()
      return
    }

    // Ensure a "GrantMaestro Platform" organisation exists for the sys admin
    let [org] = await sequelize.query(
      `SELECT organization_id FROM grant_organizations WHERE email = ? AND is_deleted = 0 LIMIT 1`,
      { replacements: ['platform@grantmaestro.com.au'], type: Sequelize.QueryTypes.SELECT }
    )
    if (!org) {
      const [insertOrgResult] = await sequelize.query(
        `INSERT INTO grant_organizations
           (organization_name, abn_no, email, phone_no, is_blocked, is_deleted, created_at, modified_at)
         VALUES (?, ?, ?, ?, 0, 0, ?, ?)`,
        {
          replacements: [
            'GrantMaestro Platform',
            '00000000000',
            'platform@grantmaestro.com.au',
            '0000000000',
            now, now,
          ],
        }
      )
      org = { organization_id: insertOrgResult }
      console.log(`Created platform organisation (id: ${org.organization_id}).`)
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 10)

    // Insert the Super Admin user
    const [insertResult] = await sequelize.query(
      `INSERT INTO grant_users
         (first_name, last_name, email, password, organization_id,
          user_type, is_otp_verified, approval_status,
          subscription_is_in_trial, subscription_status,
          requires_password_reset, is_blocked, is_deleted,
          created_at, modified_at)
       VALUES (?, ?, ?, ?, ?, ?, 1, 1, 0, 1, 0, 0, 0, ?, ?)`,
      {
        replacements: [
          ADMIN_FIRST,
          ADMIN_LAST,
          ADMIN_EMAIL,
          hashedPassword,
          org.organization_id,
          SUPER_ADMIN_ROLE_ID,
          now, now,
        ],
      }
    )

    console.log(`✓ Sys Admin created successfully!`)
    console.log(`  Email   : ${ADMIN_EMAIL}`)
    console.log(`  Password: ${ADMIN_PASSWORD}`)
    console.log(`  user_id : ${insertResult}`)
    console.log(`  Role    : Super Admin (role_id ${SUPER_ADMIN_ROLE_ID})`)

    await sequelize.close()
  } catch (err) {
    console.error('Seed failed:', err.message)
    process.exit(1)
  }
}

seed()
