/**
 * Creates every table defined by the Sequelize models (src/models). On an
 * existing database it only adds tables that are missing.
 */
export const up = async () => {
  process.env.DB_LOGGING = 'false'
  const { databaseReady, sequelize } = await import('../../src/models/base.js')
  try {
    await databaseReady
  } finally {
    await sequelize.close()
  }
}
