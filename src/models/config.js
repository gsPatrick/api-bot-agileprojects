module.exports = (sequelize, DataTypes) => {
    const SystemConfig = sequelize.define('SystemConfig', {
        key: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true,
        },
        value: {
            type: DataTypes.TEXT,
            allowNull: false,
        },
        description: {
            type: DataTypes.STRING,
            allowNull: true,
        },
    });

    return SystemConfig;
};
