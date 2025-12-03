const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class User extends Model {
        static associate(models) {
            // define association here
        }
    }
    User.init({
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        name: DataTypes.STRING,
        email: {
            type: DataTypes.STRING,
            unique: true,
            allowNull: false,
        },
        bot_number: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        password_hash: {
            type: DataTypes.STRING,
            allowNull: false,
        },
    }, {
        sequelize,
        modelName: 'User',
    });
    return User;
};
