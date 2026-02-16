
export default (sequelize, Sequelize) => {
    return sequelize.define('grant_subscription_plans',
        {
            plan_id: { type: Sequelize.INTEGER(10).UNSIGNED, autoIncrement: true, allowNull: false, primaryKey: true },
            plan_name: {type:Sequelize.STRING, allowNull: false},
            plan_description: { type: Sequelize.TEXT, allowNull: false },
            plan_duration: { type: Sequelize.ENUM("day","week","month","year"), allowNull: false },
            plan_price: {type:Sequelize.FLOAT(6,2), allowNull: false},
            stripe_plan_id: {type:Sequelize.STRING, allowNull: false},
            trial_days: {type: Sequelize.INTEGER(10), allowNull:false, defaultValue:0},
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
                    fields: ['plan_id']
                }
            ],
            timestamps: false,
            freezeTableName: true
        }
    );
}