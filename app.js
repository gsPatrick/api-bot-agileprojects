require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { sequelize } = require('./src/models');
const routes = require('./src/routes');
const logger = require('./src/utils/logger.utils');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api', routes);

// Global Error Handler
app.use((err, req, res, next) => {
    logger.error('Unhandled Error', err);
    res.status(500).json({
        success: false,
        message: 'Internal Server Error',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
});

// Start Server
const startServer = async () => {
    try {
        await sequelize.authenticate();
        logger.info('Database connected successfully.');

        // Sync models (use { force: true } only for dev to reset DB)
        // await sequelize.sync({ alter: true }); 
        await sequelize.sync();
        logger.info('Database synced.');

        app.listen(PORT, () => {
            logger.info(`Server running on port ${PORT}`);
        });
    } catch (error) {
        logger.error('Unable to connect to the database:', error);
        process.exit(1);
    }
};

startServer();
