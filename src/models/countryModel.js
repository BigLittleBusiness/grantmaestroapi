
export default (sequelize, Sequelize) => {
    return sequelize.define('grant_country',
        {
            country_id: { type: Sequelize.INTEGER(10).UNSIGNED, autoIncrement: true, allowNull: false, primaryKey: true },
            country_name: { type: Sequelize.STRING, allowNull: false },
            phone_code: { type: Sequelize.STRING, allowNull: true },
            
            
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
                    fields: ['country_id']
                }
            ],
            timestamps: false,
            freezeTableName: true
        }
    );
}