
export default (sequelize, Sequelize) => {
    return sequelize.define('grant_tasks',
        {
            task_id: { type: Sequelize.INTEGER(10).UNSIGNED, autoIncrement: true, allowNull: false, primaryKey: true },
            task_description: { type: Sequelize.TEXT, allowNull: false },
            task_status:{ type: Sequelize.ENUM("assigned","pending", "inprogress", "completed"), allowNull: false, defaultValue:'assigned' },
            task_assigned_to:{type: Sequelize.INTEGER(10).UNSIGNED, allowNull:true, references: { model:'grant_users', key:'user_id'}},
            task_completion_date: { type: Sequelize.DATEONLY, allowNull: true},
            task_start_date: { type: Sequelize.DATEONLY, allowNull: true},
            targeted_completion_date: { type: Sequelize.DATEONLY, allowNull: true},
            organization_grant_id: { type: Sequelize.INTEGER(10).UNSIGNED, allowNull: false, references: { model:'grant_organization_grants', key:'organization_grant_id'} },
            
            is_blocked: { type: Sequelize.BOOLEAN, defaultValue:0 },
            is_deleted: { type: Sequelize.BOOLEAN, defaultValue:0 },
            created_at: { type: Sequelize.DATE, allowNull: false , defaultValue: Sequelize.NOW},
            modified_at: { type: Sequelize.DATE, allowNull: false ,  defaultValue: Sequelize.NOW},
            deleted_at: { type: Sequelize.DATE, allowNull: true },
        },
        {
            indexes: [
                {
                    unique: true,
                    fields: ['task_id']
                }
            ],
            timestamps: false,
            freezeTableName: true
        }
    );
}