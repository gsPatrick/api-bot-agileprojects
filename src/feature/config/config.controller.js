const { SystemConfig } = require('../../models');
const logger = require('../../utils/logger.utils');

class ConfigController {
    async getAll(req, res) {
        try {
            const configs = await SystemConfig.findAll();
            res.json(configs);
        } catch (error) {
            logger.error('Error fetching configs:', error);
            res.status(500).json({ error: 'Failed to fetch configurations' });
        }
    }

    async update(req, res) {
        try {
            const { key } = req.params;
            const { value } = req.body;

            let config = await SystemConfig.findOne({ where: { key } });

            if (config) {
                await config.update({ value });
            } else {
                config = await SystemConfig.create({ key, value });
            }

            res.json(config);
        } catch (error) {
            logger.error('Error updating config:', error);
            res.status(500).json({ error: 'Failed to update configuration' });
        }
    }

    async getByKey(req, res) {
        try {
            const { key } = req.params;
            const config = await SystemConfig.findOne({ where: { key } });

            if (!config) {
                return res.status(404).json({ error: 'Config not found' });
            }

            res.json(config);
        } catch (error) {
            logger.error('Error fetching config:', error);
            res.status(500).json({ error: 'Failed to fetch configuration' });
        }
    }
}

module.exports = new ConfigController();
