import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const dataDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../data')

/** Runs a data/*.sql insert file, skipping rows whose primary key already exists. */
export const insertSqlFileIgnoringExisting = async (connection, fileName) => {
  const sql = fs.readFileSync(path.join(dataDir, fileName), 'utf8')
    .replace(/INSERT\s+INTO/gi, 'INSERT IGNORE INTO')
  const [result] = await connection.query(sql)
  const results = Array.isArray(result) ? result : [result]
  return results.reduce((total, item) => total + (item.affectedRows || 0), 0)
}
