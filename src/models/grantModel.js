export default (sequelize, Sequelize) => {
  return sequelize.define(
    'grant_organization_grants',
    {
      organization_grant_id: {
        type: Sequelize.INTEGER(10).UNSIGNED,
        autoIncrement: true,
        allowNull: false,
        primaryKey: true,
      },
      grant_title: { type: Sequelize.STRING, allowNull: false },
      origination_url: { type: Sequelize.STRING, allowNull: true },
      fund_originator: { type: Sequelize.STRING, allowNull: false },
      max_fund_amount: { type: Sequelize.DOUBLE.UNSIGNED, allowNull: false },
      funding_sought_amount: { type: Sequelize.DOUBLE.UNSIGNED, allowNull: true },
      opening_date: { type: Sequelize.DATEONLY, allowNull: true },
      latest_finding_note: {
        type: Sequelize.TEXT,
        allowNull: false,
        defaultValue: '',
      },
      grant_added_by: {
        type: Sequelize.INTEGER(10).UNSIGNED,
        allowNull: false,
        references: { model: 'grant_users', key: 'user_id' },
      },
      category_id: {
        type: Sequelize.INTEGER(10).UNSIGNED,
        allowNull: true,
        references: { model: 'grant_category', key: 'grant_category_id' },
      },
      organization_id: {
        type: Sequelize.INTEGER(10).UNSIGNED,
        allowNull: false,
        references: { model: 'grant_organizations', key: 'organization_id' },
      },

      is_suitable: { type: Sequelize.BOOLEAN, defaultValue: 0 },
      decision_date: { type: Sequelize.DATEONLY, allowNull: true },
      closing_date: { type: Sequelize.DATEONLY, allowNull: true },
      determination: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: '',
      },
      rationale_of_importance: { type: Sequelize.STRING, allowNull: true },
      assessment_outcome_date: { type: Sequelize.DATEONLY, allowNull: true },
      latest_suitability_note: {
        type: Sequelize.TEXT,
        allowNull: false,
        defaultValue: '',
      },

      is_grant_submitted: { type: Sequelize.BOOLEAN, defaultValue: false },
      grant_submitted_by: {
        type: Sequelize.INTEGER(10).UNSIGNED,
        allowNull: true,
        defaultValue: 1,
        references: { model: 'grant_users', key: 'user_id' },
      },
      grant_submission_date: { type: Sequelize.DATEONLY, allowNull: true },
      submission_department: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: '',
      },
      submission_department_representative: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: '',
      },
      submission_project_name: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: '',
      },
      submission_reasoning: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: '',
      },
      submission_co_contributor: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: '',
      },
      is_grant_rejected: { type: Sequelize.BOOLEAN, defaultValue: true },
      grant_application_rejection_reason: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      latest_submission_note: {
        type: Sequelize.TEXT,
        allowNull: false,
        defaultValue: '',
      },

      outcome: { type: Sequelize.STRING, allowNull: true },
      outcome_date: { type: Sequelize.DATEONLY, allowNull: true },
      agreement_signed: { type: Sequelize.STRING, allowNull: true },
      learning: { type: Sequelize.TEXT, allowNull: true },
      latest_outcome_note: {
        type: Sequelize.TEXT,
        allowNull: false,
        defaultValue: '',
      },

      latest_report_note: {
        type: Sequelize.TEXT,
        allowNull: false,
        defaultValue: '',
      },

      won_fund_amount: { type: Sequelize.DOUBLE.UNSIGNED, allowNull: true },
      received_fund_amount: { type: Sequelize.DOUBLE.UNSIGNED, allowNull: true },
      fund_amount_due: { type: Sequelize.DOUBLE.UNSIGNED, allowNull: true },
      total_amount_spent: { type: Sequelize.DOUBLE.UNSIGNED, allowNull: true },
      remaining_fund_amount: {
        type: Sequelize.DOUBLE.UNSIGNED,
        allowNull: true,
        defaultValue: 0.0,
      },
      latest_financial_note: {
        type: Sequelize.TEXT,
        allowNull: false,
        defaultValue: '',
      },

      account_used_for_expenses: { type: Sequelize.STRING, allowNull: true },

      grant_status: {
        type: Sequelize.ENUM(
          '',
          'applied',
          'pending',
          'inprogress',
          'completed'
        ),
        allowNull: false,
        defaultValue: '',
      },
      is_blocked: { type: Sequelize.BOOLEAN, defaultValue: 0 },
      is_deleted: { type: Sequelize.BOOLEAN, defaultValue: 0 },
      created_at: { type: Sequelize.DATE, defaultValue: Sequelize.NOW },
      modified_at: { type: Sequelize.DATE, defaultValue: Sequelize.NOW },
      deleted_at: { type: Sequelize.DATE, allowNull: true },
    },
    {
      indexes: [
        {
          unique: true,
          fields: ['organization_grant_id'],
        },
      ],
      timestamps: false,
      freezeTableName: true,
    }
  )
}
