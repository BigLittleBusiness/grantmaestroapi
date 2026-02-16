
export default (sequelize, Sequelize) => {
    return sequelize.define('grant_organizations',
        {
            organization_id: { type: Sequelize.INTEGER(10).UNSIGNED, autoIncrement: true, allowNull: false, primaryKey: true },
            organization_name: { type: Sequelize.STRING, allowNull: false },
            abn_no: { type: Sequelize.STRING(30), allowNull: false },
            email: { type: Sequelize.STRING, allowNull: false },
            phone_no:{type: Sequelize.STRING(10),allowNull:false},
            address:{type: Sequelize.TEXT ,allowNull:true},
            organization_logo:{ type: Sequelize.STRING, allowNull: true },
            organization_website:{ type: Sequelize.STRING, allowNull: true },
            organization_type:{ type: Sequelize.STRING, allowNull: true },
            
            created_by:{type: Sequelize.INTEGER(10).UNSIGNED, allowNull:true, references: { model:'grant_users', key:'user_id'}},
            
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
                    fields: ['organization_id']
                }
            ],
            timestamps: false,
            freezeTableName: true
        }
    );
}