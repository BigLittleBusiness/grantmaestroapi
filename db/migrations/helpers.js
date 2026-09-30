export const columnExists = async (connection, table, column) => {
  const [rows] = await connection.query(`SHOW COLUMNS FROM \`${table}\` LIKE ?`, [column])
  return rows.length > 0
}

/** Adds a column unless it exists (tables created from the models already have it). */
export const addColumnIfMissing = async (connection, table, column, definition) => {
  if (!await columnExists(connection, table, column)) {
    await connection.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`)
  }
}
