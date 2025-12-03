const express = require('express');
const router = express.Router();
const configController = require('./config.controller');

router.get('/', configController.getAll);
router.get('/:key', configController.getByKey);
router.post('/:key', configController.update);

module.exports = router;
