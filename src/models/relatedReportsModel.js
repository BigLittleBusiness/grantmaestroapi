
export default (sequelize, Sequelize) => {
    return sequelize.define('grant_related_reports',
        {
            report_id: { type: Sequelize.INTEGER(10).UNSIGNED, autoIncrement: true, allowNull: false, primaryKey: true },
            report_title: { type: Sequelize.STRING, allowNull: false },
            report_submission_date: { type: Sequelize.DATEONLY, allowNull: false },
            report_status: { type: Sequelize.ENUM("","Submitted","Pending"), allowNull: false , defaultValue:"Submitted"},
            // report_file_path: { type: Sequelize.STRING, allowNull: false },
            report_template_received: { type: Sequelize.BOOLEAN, defaultValue: false },
            report_template_file_path: { type: Sequelize.STRING, allowNull: true },
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
                    fields: ['report_id']
                }
            ],
            timestamps: false,
            freezeTableName: true
        }
    );
}