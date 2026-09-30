import { insertSqlFileIgnoringExisting } from './helpers.js'

export const run = async ({ connection }) => {
  const countries = await insertSqlFileIgnoringExisting(connection, 'countries.sql')
  const states = await insertSqlFileIgnoringExisting(connection, 'states.sql')
  return `${countries} countries, ${states} states added`
}
