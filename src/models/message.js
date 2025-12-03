const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class Message extends Model {
        static associate(models) {
            Message.belongsTo(models.Contact, { foreignKey: 'contact_id', as: 'contact' });
        }
    }
    Message.init({
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        contact_id: {
            type: DataTypes.UUID,
            allowNull: false,
        },
        from_me: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
        },
        body: {
            type: DataTypes.TEXT,
            allowNull: false,
        },
        timestamp: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW,
        },
    }, {
        sequelize,
        modelName: 'Message',
    });
    return Message;
};
