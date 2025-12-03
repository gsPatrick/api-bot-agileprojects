const { Contact, Message } = require('../../models');
const zapiService = require('../../utils/zapi.service');

class ContactService {
    async listContacts() {
        return await Contact.findAll({
            order: [['last_interaction', 'DESC']],
        });
    }

    async getMessages(phone) {
        const contact = await Contact.findOne({ where: { phone } });
        if (!contact) {
            throw new Error('Contact not found');
        }
        return await Message.findAll({
            where: { contact_id: contact.id },
            order: [['timestamp', 'ASC']],
        });
    }

    async togglePause(phone, paused) {
        const contact = await Contact.findOne({ where: { phone } });
        if (!contact) {
            throw new Error('Contact not found');
        }
        contact.is_bot_paused = paused;
        await contact.save();
        return contact;
    }

    async sendMessage(phone, messageBody) {
        const contact = await Contact.findOne({ where: { phone } });
        if (!contact) {
            throw new Error('Contact not found');
        }

        // Send via Z-API
        await zapiService.sendText(phone, messageBody);

        // Save to DB
        const message = await Message.create({
            contact_id: contact.id,
            from_me: true,
            body: messageBody,
        });

        return message;
    }
}

module.exports = new ContactService();
