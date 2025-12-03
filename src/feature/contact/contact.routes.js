const express = require('express');
const router = express.Router();
const contactController = require('./contact.controller');

// Add auth middleware here if needed, for now keeping it open or assuming global middleware
router.get('/', contactController.listContacts);
router.get('/:phone/messages', contactController.getMessages);
router.post('/:phone/toggle-pause', contactController.togglePause);
router.post('/:phone/send', contactController.sendMessage);

module.exports = router;
