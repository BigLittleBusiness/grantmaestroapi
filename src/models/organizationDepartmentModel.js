
export default (sequelize, Sequelize) => {
    return sequelize.define('grant_organization_departments',
        {
            organization_dept_id: { type: Sequelize.INTEGER(10).UNSIGNED, autoIncrement: true, allowNull: false, primaryKey: true },
            department_name: { type: Sequelize.STRING, allowNull: false },
            
            
            organization_id:{type: Sequelize.INTEGER(10).UNSIGNED, allowNull:true, references: { model:'grant_organizations', key:'organization_id'}},
            
            is_blocked: { type: Sequelize.BOOLEAN, defaultValue:0 },
            is_deleted: { type: Sequelize.BOOLEAN, defaultValue:0 },
            created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
            modified_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
            deleted_at: { type: Sequelize.DATE, allowNull: true },
        },
        {
            indexes: [
                {
                    unique: true,
                    fields: ['organization_dept_id']
                }
            ],
            timestamps: false,
            freezeTableName: true
        }
    );
}