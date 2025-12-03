const axios = require('axios');
const config = require('../config/zapi');
const logger = require('../utils/logger.utils');

class ZApiService {
    constructor() {
        this.baseUrl = `${config.baseUrl}/${config.instanceId}/token/${config.token}`;
    }

    async sendText(phone, message) {
        try {
            const url = `${this.baseUrl}/send-text`;
            const payload = {
                phone,
                message,
            };

            const response = await axios.post(url, payload);
            logger.info(`Message sent to ${phone}`, { messageId: response.data.messageId });
            return response.data;
        } catch (error) {
            logger.error(`Failed to send message to ${phone}`, error.response ? error.response.data : error.message);
            throw error;
        }
    }
}

module.exports = new ZApiService();
