
export default (sequelize, Sequelize) => {
    return sequelize.define('grant_related_files',
        {
            related_file_id: { type: Sequelize.INTEGER(10).UNSIGNED, autoIncrement: true, allowNull: false, primaryKey: true },
            file_path: { type: Sequelize.STRING, allowNull: false },
            organization_grant_id: { type: Sequelize.INTEGER(10).UNSIGNED, allowNull: false, references: { model:'grant_organization_grants', key:'organization_grant_id'} },
            related_report_id: { type: Sequelize.INTEGER(10).UNSIGNED, allowNull: true, references: { model:'grant_related_reports', key:'report_id'} },
            
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
                    fields: ['related_file_id']
                }
            ],
            timestamps: false,
            freezeTableName: true
        }
    );
}