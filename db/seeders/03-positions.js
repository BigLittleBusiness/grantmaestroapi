import { insertSqlFileIgnoringExisting } from './helpers.js'

export const run = async ({ connection }) => {
  const positions = await insertSqlFileIgnoringExisting(connection, 'masterData.sql')
  return `${positions} positions added`
}
