require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { sequelize } = require('./src/models');
const routes = require('./src/routes');
const logger = require('./src/utils/logger.utils');

const http = require('http');
const socketUtils = require('./src/utils/socket.utils');

const app = express();
const server = http.createServer(app); // Create HTTP server
const PORT = process.env.PORT || 3000;

// Initialize Socket.io
socketUtils.init(server);

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

        // Sync models com force: true para resetar e aplicar schema
        await sequelize.sync({ force: true });
        logger.info('Database synced with force: true (DATA RESET).');

        // Seed Admin User
        const { User } = require('./src/models');
        const bcrypt = require('bcryptjs');

        const adminEmail = 'agileprojectsweb@gmail.com';
        const adminPassword = 'Agileprojects123';

        const existingAdmin = await User.findOne({ where: { email: adminEmail } });
        if (!existingAdmin) {
            const salt = await bcrypt.genSalt(10);
            const password_hash = await bcrypt.hash(adminPassword, salt);

            await User.create({
                name: 'Agile Admin',
                email: adminEmail,
                password_hash: password_hash,
                bot_number: '557182862912', // Bot number to ignore (Admin)
                notification_number: '557182862912', // Number to receive notifications
            });
            logger.info('Default admin user created.');
        } else {
            logger.info('Default admin user already exists.');
        }

        server.listen(PORT, () => {
            logger.info(`Server running on port ${PORT}`);
        });

    } catch (error) {
        logger.error('Unable to connect to the database:', error);
        process.exit(1);
    }
};


startServer();
