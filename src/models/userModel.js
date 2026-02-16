import bcrypt from 'bcryptjs'
//
export default (sequelize, Sequelize) => {
  return sequelize.define(
    'grant_users',
    {
      user_id: {
        type: Sequelize.INTEGER(10).UNSIGNED,
        autoIncrement: true,
        allowNull: false,
        primaryKey: true,
      },
      first_name: { type: Sequelize.STRING, allowNull: false },
      middle_name: { type: Sequelize.STRING, allowNull: true },
      last_name: { type: Sequelize.STRING, allowNull: false },
      email: { type: Sequelize.STRING, allowNull: false },
      password: { type: Sequelize.TEXT, allowNull: false },

      phone_no: { type: Sequelize.STRING(20), allowNull: true },
      address: { type: Sequelize.TEXT, allowNull: true },
      organization_id: {
        type: Sequelize.INTEGER(10).UNSIGNED,
        allowNull: false,
        references: { model: 'grant_organizations', key: 'organization_id' },
      },
      organization_department_id: {
        type: Sequelize.INTEGER(10).UNSIGNED,
        allowNull: true,
        references: {
          model: 'grant_organization_departments',
          key: 'organization_dept_id',
        },
      },
      position_id: {
        type: Sequelize.INTEGER(10).UNSIGNED,
        allowNull: true,
        references: { model: 'grant_masterdata', key: 'masterdata_id' },
      },
      position_text: { type: Sequelize.STRING(50), allowNull: true },
      state_id: { type: Sequelize.INTEGER(10).UNSIGNED, allowNull: true },
      country_id: {
        type: Sequelize.INTEGER(10).UNSIGNED,
        allowNull: true,
        references: { model: 'grant_country', key: 'country_id' },
      },
      profile_image: { type: Sequelize.STRING, allowNull: true },

      account_verification_otp: { type: Sequelize.STRING(4), allowNull: true },
      is_otp_verified: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: 0,
      },
      otp_verified_at: { type: Sequelize.DATE, allowNull: true },

      user_type: {
        type: Sequelize.INTEGER(10).UNSIGNED,
        allowNull: false,
        references: { model: 'grant_user_roles', key: 'role_id' },
      },
      // 1 = Super Admin, 2 = Organization Admin, 3=HOD, 4 = Member
      approval_status: {
        type: Sequelize.INTEGER(1).UNSIGNED,
        allowNull: false,
        defaultValue: 1,
      }, // 1 = Pending, 2 = Approved, 3 = Rejected
      approval_by: {
        type: Sequelize.INTEGER(10).UNSIGNED,
        allowNull: true,
        references: { model: 'grant_users', key: 'user_id' },
      },
      approval_at: { type: Sequelize.DATE, allowNull: true },

      reset_password_otp: { type: Sequelize.STRING(6), defaultValue: '' },
      reset_password_attempted: { type: Sequelize.INTEGER, defaultValue: 0 },
      reset_password_attempted_on: {
        type: Sequelize.DATEONLY,
        allowNull: true,
      },

      has_profile_updated: { type: Sequelize.BOOLEAN, defaultValue: false },

      preferred_subscription_plan_id: {
        type: Sequelize.INTEGER(10).UNSIGNED,
        allowNull: true,
        references: { model: 'grant_subscription_plans', key: 'plan_id' },
      },
      subscription_plan_id: {
        type: Sequelize.INTEGER(10).UNSIGNED,
        allowNull: true,
        references: { model: 'grant_subscription_plans', key: 'plan_id' },
      },
      subscription_renewal_date: { type: Sequelize.DATEONLY, allowNull: true },
      subscription_expiry_date: { type: Sequelize.DATEONLY, allowNull: true },
      subscription_is_in_trial: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      subscription_status: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },

      stripe_customer_id: { type: Sequelize.STRING(50), defaultValue: '' },
      stripe_subscription_id: { type: Sequelize.STRING(50), defaultValue: '' },

      token: { type: Sequelize.STRING(600), allowNull: true },
      refresh_token: { type: Sequelize.STRING(600), allowNull: true },
      is_valid_refresh_token: { type: Sequelize.BOOLEAN, defaultValue: false },
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
      deleted_at: { type: Sequelize.DATE, allowNull: true },
    },
    {
      indexes: [
        {
          unique: true,
          fields: ['user_id'],
        },
      ],
      hooks: {
        beforeCreate: (user, options) => {
          {
            user.password =
              user.password && user.password != ''
                ? bcrypt.hashSync(user.password, 8)
                : ''
          }
        },
      },
      timestamps: false,
      freezeTableName: true,
    }
  )
}
