import '../src/env.js'
import mysql from 'mysql2/promise'

const categories = [
  'Academic Research',
  'Ageing',
  'Agriculture',
  'Arts and Culture',
  'Children, Youth and Youth at Risk',
  'Community Development',
  'Crime, Justice and Legal Issues',
  'Cultural and Linguistic Diversity',
  'Disability',
  'Disaster Relief',
  'Education',
  'Employment and Training',
  'Environment, Energy and Resources',
  'Government and Politics',
  'Health, Wellbeing and Medical Research',
  'Housing and Homelessness',
  'Indigenous',
  'Industry',
  'Information and Communication',
  'International Aid and Development',
  'Local Government',
  'Philanthropy, Voluntarism and Not-for-Profits Infrastructure',
  'Recreation and Sport',
  'Science and Technology',
  'Social Inclusion and Social Justice',
  'Trade and Tourism',
  'Transport and Infrastructure',
  'Veterans and Defence',
  'Other',
]

const connection = await mysql.createConnection({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
})

try {
  await connection.beginTransaction()

  await connection.query(`
    INSERT INTO grant_user_roles (role_id, name, is_blocked, is_deleted, created_at, modified_at)
    VALUES
      (1, 'Organisation Admin', 0, 0, NOW(), NOW()),
      (2, 'Platform Super Admin', 0, 0, NOW(), NOW()),
      (3, 'Team Member', 0, 0, NOW(), NOW()),
      (4, 'Acquittal Contributor', 0, 0, NOW(), NOW())
    ON DUPLICATE KEY UPDATE
      name = VALUES(name), is_blocked = 0, is_deleted = 0, modified_at = NOW()
  `)

  // Historical public registrations used role 2. Keep only the dedicated
  // GrantMaestro Platform organisation as Platform Super Admin.
  await connection.query(`
    UPDATE grant_users u
    INNER JOIN grant_organizations o ON o.organization_id = u.organization_id
    SET u.user_type = 1, u.modified_at = NOW()
    WHERE u.user_type = 2
      AND o.organization_name <> 'GrantMaestro Platform'
  `)

  const [acquittalColumn] = await connection.query(`
    SHOW COLUMNS FROM grant_organization_grants LIKE 'acquittal_date'
  `)
  if (acquittalColumn.length === 0) {
    await connection.query(`
      ALTER TABLE grant_organization_grants
      ADD COLUMN acquittal_date DATE NULL AFTER agreement_signed
    `)
  }

  const [existingCategories] = await connection.query(`
    SELECT grant_category_name FROM grant_category WHERE is_deleted = 0
  `)
  const existingNames = new Set(
    existingCategories.map((row) => row.grant_category_name.trim().toLowerCase())
  )
  const missingCategories = categories.filter(
    (name) => !existingNames.has(name.toLowerCase())
  )
  if (missingCategories.length) {
    await connection.query(
      `INSERT INTO grant_category
        (grant_category_name, is_blocked, is_deleted, created_at, modified_at)
       VALUES ?`,
      [missingCategories.map((name) => [name, 0, 0, new Date(), new Date()])]
    )
  }

  await connection.commit()
  console.log(
    `Launch readiness migration complete. Added ${missingCategories.length} missing grant categories.`
  )
} catch (error) {
  await connection.rollback()
  console.error('Launch readiness migration failed:', error.message)
  process.exitCode = 1
} finally {
  await connection.end()
}
