const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class Contact extends Model {
        static associate(models) {
            Contact.hasMany(models.Message, { foreignKey: 'contact_id', as: 'messages' });
            Contact.hasOne(models.LeadProfile, { foreignKey: 'contact_id', as: 'profile' });
        }
    }
    Contact.init({
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        phone: {
            type: DataTypes.STRING,
            unique: true,
            allowNull: false,
        },
        name: DataTypes.STRING,
        pic_url: DataTypes.STRING,
        is_bot_paused: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
        },
        flow_step: {
            type: DataTypes.STRING,
            defaultValue: 'NEW',
        },
        flow_data: {
            type: DataTypes.JSONB,
            defaultValue: {},
        },
        last_interaction: DataTypes.DATE,
    }, {
        sequelize,
        modelName: 'Contact',
        indexes: [
            {
                unique: true,
                fields: ['phone'],
            },
        ],
    });
    return Contact;
};
