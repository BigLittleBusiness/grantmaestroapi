export default (sequelize, Sequelize) => sequelize.define(
  'grant_task_checklist_items',
  {
    task_checklist_item_id: { type: Sequelize.INTEGER(10).UNSIGNED, autoIncrement: true, primaryKey: true },
    task_id: { type: Sequelize.INTEGER(10).UNSIGNED, allowNull: false },
    item_text: { type: Sequelize.STRING(500), allowNull: false },
    is_complete: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
    completed_at: { type: Sequelize.DATE, allowNull: true },
    completed_by_user_id: { type: Sequelize.INTEGER(10).UNSIGNED, allowNull: true },
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
