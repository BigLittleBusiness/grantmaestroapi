/**
 * Applies pending migrations in db/migrations, in filename order. Each one runs
 * once per database and is recorded in grant_schema_migrations.
 *
 *   npm run db:migrate            # apply pending migrations
 *   npm run db:migrate -- --status
 *
 * A migration exports `up({ connection })`, where `connection` is a mysql2
 * promise connection. Name new files <YYYYMMDDHHmm>-<description>.js.
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath, pathToFileURL } from 'url'
import { createConnection } from './connection.js'

const migrationsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'migrations')
const statusOnly = process.argv.includes('--status')

const connection = await createConnection()
try {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS grant_schema_migrations (
      name VARCHAR(255) NOT NULL PRIMARY KEY,
      applied_at DATETIME NOT NULL
    )
  `)
  const [rows] = await connection.query('SELECT name FROM grant_schema_migrations')
  const applied = new Set(rows.map((row) => row.name))
  const files = fs.readdirSync(migrationsDir).filter((file) => /^\d+-.+\.js$/.test(file)).sort()
  const pending = files.filter((file) => !applied.has(file))

  if (statusOnly) {
    for (const file of files) console.log(`${applied.has(file) ? 'applied' : 'pending'}  ${file}`)
  } else if (!pending.length) {
    console.log('Database is up to date.')
  } else {
    for (const file of pending) {
      process.stdout.write(`Applying ${file} ... `)
      const migration = await import(pathToFileURL(path.join(migrationsDir, file)).href)
      await migration.up({ connection })
      await connection.query('INSERT INTO grant_schema_migrations (name, applied_at) VALUES (?, NOW())', [file])
      console.log('done')
    }
    console.log(`Applied ${pending.length} migration(s).`)
  }
} catch (error) {
  console.error(`\nMigration failed: ${error.message}`)
  process.exitCode = 1
} finally {
  await connection.end()
}
