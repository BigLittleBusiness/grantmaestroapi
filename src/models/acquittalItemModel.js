export default (sequelize, Sequelize) => sequelize.define(
  'grant_acquittal_items',
  {
    acquittal_item_id: { type: Sequelize.INTEGER(10).UNSIGNED, autoIncrement: true, primaryKey: true },
    organization_grant_id: { type: Sequelize.INTEGER(10).UNSIGNED, allowNull: false },
    item_title: { type: Sequelize.STRING(255), allowNull: false },
    item_type: { type: Sequelize.ENUM('evidence', 'finance', 'approval', 'submission'), allowNull: false, defaultValue: 'evidence' },
    is_required: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
    status: { type: Sequelize.ENUM('not_started', 'in_progress', 'ready_for_review', 'complete', 'not_required'), allowNull: false, defaultValue: 'not_started' },
    owner_user_id: { type: Sequelize.INTEGER(10).UNSIGNED, allowNull: true },
    due_date: { type: Sequelize.DATEONLY, allowNull: true },
    evidence_note: { type: Sequelize.TEXT, allowNull: true },
    completed_at: { type: Sequelize.DATE, allowNull: true },
    created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    modified_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    is_deleted: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
  },
  {
    timestamps: false,
    freezeTableName: true,
    defaultScope: { where: { is_deleted: 0 } },
    scopes: { withDeleted: {} },
  }
)
