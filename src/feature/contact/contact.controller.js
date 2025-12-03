const contactService = require('./contact.service');
const response = require('../../utils/response.utils');

class ContactController {
    async listContacts(req, res) {
        try {
            const contacts = await contactService.listContacts();
            return response.success(res, contacts);
        } catch (error) {
            return response.error(res, error.message);
        }
    }

    async getMessages(req, res) {
        try {
            const { phone } = req.params;
            const messages = await contactService.getMessages(phone);
            return response.success(res, messages);
        } catch (error) {
            return response.error(res, error.message);
        }
    }

    async togglePause(req, res) {
        try {
            const { phone } = req.params;
            const { paused } = req.body;
            const contact = await contactService.togglePause(phone, paused);
            return response.success(res, contact, `Bot ${paused ? 'paused' : 'resumed'} for contact`);
        } catch (error) {
            return response.error(res, error.message);
        }
    }

    async sendMessage(req, res) {
        try {
            const { phone } = req.params;
            const { message } = req.body;
            const sentMessage = await contactService.sendMessage(phone, message);
            return response.success(res, sentMessage, 'Message sent');
        } catch (error) {
            return response.error(res, error.message);
        }
    }
}

module.exports = new ContactController();
