/**
 * Loads required reference data and the platform admin. Every seeder is
 * idempotent: it only inserts rows that are missing, so it is safe to run on
 * every deploy and never overwrites data edited in the app.
 *
 *   npm run db:seed
 *
 * A seeder exports `run({ connection })` returning a one-line summary.
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath, pathToFileURL } from 'url'
import { createConnection } from './connection.js'

const seedersDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'seeders')

const connection = await createConnection()
try {
  const files = fs.readdirSync(seedersDir).filter((file) => /^\d+-.+\.js$/.test(file)).sort()
  for (const file of files) {
    const seeder = await import(pathToFileURL(path.join(seedersDir, file)).href)
    await connection.beginTransaction()
    try {
      const summary = await seeder.run({ connection })
      await connection.commit()
      console.log(`${file.replace(/\.js$/, '').padEnd(28)} ${summary}`)
    } catch (error) {
      await connection.rollback()
      throw new Error(`${file}: ${error.message}`)
    }
  }
  console.log('Seeding complete.')
} catch (error) {
  console.error(`Seeding failed: ${error.message}`)
  process.exitCode = 1
} finally {
  await connection.end()
}
