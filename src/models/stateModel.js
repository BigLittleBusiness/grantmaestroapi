
export default (sequelize, Sequelize) => {
    return sequelize.define('grant_states',
        {
            state_id: { type: Sequelize.INTEGER(10).UNSIGNED, autoIncrement: true, allowNull: false, primaryKey: true },
            name: { type: Sequelize.STRING, allowNull: false },
            state_code: { type: Sequelize.STRING, allowNull: true },
            country_id:{type: Sequelize.INTEGER(10).UNSIGNED, allowNull:true, references: { model:'grant_country', key:'country_id'}},
            
            
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
                    fields: ['state_id']
                }
            ],
            timestamps: false,
            freezeTableName: true
        }
    );
}