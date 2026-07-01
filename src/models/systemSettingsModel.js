/**
 * grant_system_settings
 *
 * A key/value store for system-wide configuration that only a Super Admin
 * (user_type = 1) can read or write.  Sensitive values (e.g. API secret keys)
 * should be stored encrypted at the application layer before being persisted.
 *
 * Current keys used by the payment subsystem:
 *   pin_publishable_key   – Pin Payments publishable key  (safe to expose to browser)
 *   pin_secret_key        – Pin Payments secret key       (server-side only, encrypted)
 *   pin_environment       – "test" | "live"
 *   pin_currency          – ISO 4217 code, default "AUD"
 *   pin_webhook_secret    – HMAC secret for webhook signature verification
 */
export default (sequelize, Sequelize) => {
  return sequelize.define(
    'grant_system_settings',
    {
      setting_id: {
        type: Sequelize.INTEGER(10).UNSIGNED,
        autoIncrement: true,
        allowNull: false,
        primaryKey: true,
      },
      setting_key: {
        type: Sequelize.STRING(100),
        allowNull: false,
        unique: true,
      },
      setting_value: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      setting_group: {
        type: Sequelize.STRING(50),
        allowNull: false,
        defaultValue: 'general',
        comment: 'Logical group: general | payment | email | storage',
      },
      is_encrypted: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'True when setting_value has been AES-encrypted',
      },
      is_blocked: { type: Sequelize.BOOLEAN, defaultValue: 0 },
      is_deleted: { type: Sequelize.BOOLEAN, defaultValue: 0 },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
      modified_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
    },
    {
      indexes: [
        { unique: true, fields: ['setting_id'] },
        { unique: true, fields: ['setting_key'] },
      ],
      timestamps: false,
      freezeTableName: true,
    }
  )
}
