const express = require('express');
const router = express.Router();

const authRoutes = require('../feature/auth/auth.routes');
const botRoutes = require('../feature/bot/bot.routes');
const contactRoutes = require('../feature/contact/contact.routes');
const configRoutes = require('../feature/config/config.routes');

router.use('/auth', authRoutes);
router.use('/webhook', botRoutes);
router.use('/contacts', contactRoutes);
router.use('/config', configRoutes);

module.exports = router;
