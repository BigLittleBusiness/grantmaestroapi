import { insertSqlFileIgnoringExisting } from './helpers.js'

// Categories required at launch that the base data file does not provide;
// added by name if missing.
const REQUIRED_CATEGORIES = ['Other']

export const run = async ({ connection }) => {
  let added = await insertSqlFileIgnoringExisting(connection, 'grantCategory.sql')
  const [rows] = await connection.query('SELECT grant_category_name FROM grant_category WHERE is_deleted = 0')
  const existing = new Set(rows.map((row) => row.grant_category_name.trim().toLowerCase()))
  for (const name of REQUIRED_CATEGORIES.filter((category) => !existing.has(category.toLowerCase()))) {
    await connection.query(
      'INSERT INTO grant_category (grant_category_name, is_blocked, is_deleted, created_at, modified_at) VALUES (?, 0, 0, NOW(), NOW())',
      [name]
    )
    added += 1
  }
  return `${added} categories added`
}
