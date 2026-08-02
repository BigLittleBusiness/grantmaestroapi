
export default (sequelize, Sequelize) => {
    return sequelize.define('grant_promo_codes',
        {
            promo_id: { type: Sequelize.INTEGER(10).UNSIGNED, autoIncrement: true, allowNull: false, primaryKey: true },
            code: { type: Sequelize.STRING(50), allowNull: false, unique: true },
            discount_type: { type: Sequelize.ENUM('percentage', 'fixed'), allowNull: false },
            discount_value: { type: Sequelize.FLOAT(8, 2), allowNull: false },
            duration_months: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
            expires_at: { type: Sequelize.DATEONLY, allowNull: true },
            is_deleted: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: 0 },
            created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
            modified_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
        },
        {
            timestamps: false,
            freezeTableName: true,
        }
    )
}
