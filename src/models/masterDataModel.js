
export default (sequelize, Sequelize) => {
    return sequelize.define('grant_masterdata',
        {
            masterdata_id: { type: Sequelize.INTEGER(10).UNSIGNED, autoIncrement: true, allowNull: false, primaryKey: true },
            masterdata_type:{type: Sequelize.TINYINT(2).UNSIGNED, allowNull:false, defaultValue:1},
            // 1 = Stuff position
            name:{type: Sequelize.STRING ,allowNull:false},
            is_blocked: { type: Sequelize.BOOLEAN, defaultValue:0 },
            is_deleted: { type: Sequelize.BOOLEAN, defaultValue:0 },
            created_at: { type: Sequelize.DATE, allowNull: false },
            modified_at: { type: Sequelize.DATE, allowNull: false },
            deleted_at: { type: Sequelize.DATE, allowNull: true },
        },
        {
            indexes: [
                {
                    unique: true,
                    fields: ['masterdata_id']
                }
            ],
            timestamps: false,
            freezeTableName: true
        }
    );
}