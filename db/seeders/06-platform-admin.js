import bcrypt from 'bcryptjs'

// The Platform Admin comes from the environment so no credentials live in the
// repository. Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD in config/config.env.
const PLATFORM_ORG_NAME = 'GrantMaestro Platform'
const PLATFORM_ORG_EMAIL = 'platform@grantmaestro.com.au'
const PLATFORM_ADMIN_ROLE = 2
const MIN_PASSWORD_LENGTH = 12

export const run = async ({ connection }) => {
  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase()
  const password = process.env.SEED_ADMIN_PASSWORD
  if (!email || !password) {
    return 'skipped (set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD to create one)'
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`SEED_ADMIN_PASSWORD must be at least ${MIN_PASSWORD_LENGTH} characters.`)
  }

  const [[existing]] = await connection.query(
    'SELECT user_id, user_type FROM grant_users WHERE email = ? AND is_deleted = 0 LIMIT 1',
    [email]
  )
  if (existing) {
    return existing.user_type === PLATFORM_ADMIN_ROLE
      ? `${email} already exists`
      : `skipped: ${email} is already used by a non-admin account`
  }

  let [[organisation]] = await connection.query(
    'SELECT organization_id FROM grant_organizations WHERE email = ? AND is_deleted = 0 LIMIT 1',
    [PLATFORM_ORG_EMAIL]
  )
  if (!organisation) {
    const [result] = await connection.query(
      `INSERT INTO grant_organizations
        (organization_name, abn_no, email, phone_no, address, is_blocked, is_deleted, created_at, modified_at)
       VALUES (?, '', ?, '', '', 0, 0, NOW(), NOW())`,
      [PLATFORM_ORG_NAME, PLATFORM_ORG_EMAIL]
    )
    organisation = { organization_id: result.insertId }
  }

  await connection.query(
    `INSERT INTO grant_users
      (first_name, last_name, email, password, organization_id, user_type, is_otp_verified,
       subscription_is_in_trial, subscription_status, requires_password_reset,
       is_blocked, is_deleted, created_at, modified_at)
     VALUES (?, ?, ?, ?, ?, ?, 1, 0, 1, 0, 0, 0, NOW(), NOW())`,
    [
      process.env.SEED_ADMIN_FIRST_NAME || 'Platform',
      process.env.SEED_ADMIN_LAST_NAME || 'Admin',
      email,
      await bcrypt.hash(password, 10),
      organisation.organization_id,
      PLATFORM_ADMIN_ROLE,
    ]
  )
  return `created ${email}`
}
