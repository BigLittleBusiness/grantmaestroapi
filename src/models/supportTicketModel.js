
export default (sequelize, Sequelize) => {
    return sequelize.define('grant_support_tickets',
        {
            ticket_id: { type: Sequelize.INTEGER(10).UNSIGNED, autoIncrement: true, allowNull: false, primaryKey: true },
            ticket_title: {type:Sequelize.STRING, allowNull: false},
            ticket_description: { type: Sequelize.TEXT, allowNull: false },
            ticket_file_path: { type: Sequelize.STRING, allowNull: true },
            ticket_status:{ type: Sequelize.ENUM("open", "assigned", "pending", "inprogress", "resolved"), allowNull: false, defaultValue:'open' },
            organization_id: { type: Sequelize.INTEGER(10).UNSIGNED, allowNull: false, references: { model:'grant_organizations', key:'organization_id'} },
            
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
                    fields: ['ticket_id']
                }
            ],
            timestamps: false,
            freezeTableName: true
        }
    );
}