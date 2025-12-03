const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class LeadProfile extends Model {
        static associate(models) {
            LeadProfile.belongsTo(models.Contact, { foreignKey: 'contact_id', as: 'contact' });
        }
    }
    LeadProfile.init({
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        contact_id: {
            type: DataTypes.UUID,
            allowNull: false,
            unique: true, // Um perfil por contato
        },
        interest: DataTypes.STRING,      // Ex: "Site Profissional"
        has_site: DataTypes.STRING,      // Ex: "Sim"
        sells_online: DataTypes.STRING,  // Ex: "Não"
        product_count: DataTypes.STRING, // Ex: "50"
        main_goal: DataTypes.STRING,     // Ex: "Vendas"
        offer_choice: DataTypes.STRING,  // Ex: "1" (Proposta)
        score: {
            type: DataTypes.INTEGER,
            defaultValue: 0
        }
    }, {
        sequelize,
        modelName: 'LeadProfile',
    });
    return LeadProfile;
};
