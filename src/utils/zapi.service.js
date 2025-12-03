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

    async sendButtonList(phone, message, buttons) {
        try {
            const url = `${this.baseUrl}/send-button-list`;
            // Estrutura específica da Z-API
            const payload = {
                phone,
                message,
                buttonList: {
                    buttons: buttons // Array de objetos { id, label }
                }
            };

            const headers = {
                'Client-Token': config.clientToken
            };

            const response = await axios.post(url, payload, { headers });
            logger.info(`Button list sent to ${phone}`);
            return response.data;
        } catch (error) {
            logger.error(`Failed to send button list to ${phone}`, error.response ? error.response.data : error.message);
            throw error; // Propaga o erro para ser tratado no controller/service
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
