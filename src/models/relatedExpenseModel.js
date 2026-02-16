
export default (sequelize, Sequelize) => {
    return sequelize.define('grant_related_item_expense',
        {
            expense_id: { type: Sequelize.INTEGER(10).UNSIGNED, autoIncrement: true, allowNull: false, primaryKey: true },
            expense_description: { type: Sequelize.STRING, allowNull: false },
            expense_amount: { type: Sequelize.DOUBLE, allowNull: false },
            expense_date: { type: Sequelize.DATEONLY, allowNull: false },
            expense_payee: { type: Sequelize.STRING, allowNull: false },
            expense_paid_by:{type: Sequelize.INTEGER(10).UNSIGNED, allowNull:true, references: { model:'grant_users', key:'user_id'}},
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
                    fields: ['expense_id']
                }
            ],
            timestamps: false,
            freezeTableName: true
        }
    );
}