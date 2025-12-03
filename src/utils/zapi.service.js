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

            const headers = {
                'Client-Token': config.clientToken
            };

            const response = await axios.post(url, payload, { headers });
            logger.info(`Message sent to ${phone}`, { messageId: response.data.messageId });
            return response.data;
        } catch (error) {
            logger.error(`Failed to send message to ${phone}`, error.response ? error.response.data : error.message);
            throw error;
        }
    }

    async getProfilePicture(phone) {
        try {
            const url = `${this.baseUrl}/profile-picture?phone=${phone}`;
            const headers = {
                'Client-Token': config.clientToken
            };
            const response = await axios.get(url, { headers });
            return response.data;
        } catch (error) {
            logger.error(`Failed to get profile picture for ${phone}`, error.response ? error.response.data : error.message);
            return null;
        }
    }

    async getContactInfo(phone) {
        try {
            const url = `${this.baseUrl}/contacts/${phone}`;
            const headers = {
                'Client-Token': config.clientToken
            };
            const response = await axios.get(url, { headers });
            return response.data;
        } catch (error) {
            logger.error(`Failed to get contact info for ${phone}`, error.response ? error.response.data : error.message);
            return null;
        }
    }
}

module.exports = new ZApiService();
