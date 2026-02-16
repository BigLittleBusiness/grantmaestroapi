
export default (sequelize, Sequelize) => {
    return sequelize.define('grant_related_community',
        {
            related_community_id: { type: Sequelize.INTEGER(10).UNSIGNED, autoIncrement: true, allowNull: false, primaryKey: true },
            community_name: { type: Sequelize.STRING, allowNull: false },
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
                    fields: ['related_community_id']
                }
            ],
            timestamps: false,
            freezeTableName: true
        }
    );
}