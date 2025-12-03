const express = require('express');
const router = express.Router();
const botController = require('./bot.controller');

router.post('/zaapi', botController.handleWebhook);

module.exports = router;
