const { Contact, Message } = require('../../models');
const zapiService = require('../../utils/zapi.service');
const geminiService = require('../../utils/gemini.service');
const logger = require('../../utils/logger.utils');

class BotService {
    async handleWebhook(data) {
        try {
            // 1. Validate & Ignore Events
            if (['PresenceChatCallback', 'MessageStatusCallback', 'DeliveryCallback'].includes(data.type)) {
                return;
            }

            // LOG FULL WEBHOOK DATA FOR DEBUGGING
            logger.info('Received Webhook Data:', JSON.stringify(data, null, 2));

            if (!data.phone || !data.text || !data.text.message) {
                // logger.warn('Invalid webhook data', data); // Reduce noise
                return;
            }

            const phone = data.phone;
            const messageBody = data.text.message;
            const fromMe = data.fromMe || false;

            // Fetch latest contact info from Z-API if it's an incoming message (or if we want to refresh)
            let contactName = data.name || 'Unknown';
            let contactPic = data.profilePicUrl || null;

            if (!fromMe) {
                try {
                    const [profilePicData, contactInfoData] = await Promise.all([
                        zapiService.getProfilePicture(phone),
                        zapiService.getContactInfo(phone)
                    ]);

                    if (profilePicData && profilePicData.link) {
                        contactPic = profilePicData.link;
                    }
                    if (contactInfoData && contactInfoData.name) {
                        contactName = contactInfoData.name;
                    }
                } catch (err) {
                    logger.warn(`Failed to fetch extra contact info for ${phone}`);
                }
            }

            // 2. Find or Create Contact
            let [contact, created] = await Contact.findOrCreate({
                where: { phone },
                defaults: {
                    name: contactName,
                    pic_url: contactPic,
                    flow_step: 'AI_CHAT',
                    flow_data: {},
                    last_interaction: new Date(),
                },
            });

            // Update contact info if changed (and we have better info)
            if (!fromMe) {
                const updateData = {};
                if (contactName !== 'Unknown' && contact.name !== contactName) updateData.name = contactName;
                if (contactPic && contact.pic_url !== contactPic) updateData.pic_url = contactPic;

                if (Object.keys(updateData).length > 0) {
                    await contact.update(updateData);
                }
            }

            // 3. Save Incoming Message
            await Message.create({
                contact_id: contact.id,
                from_me: fromMe,
                body: messageBody,
            });

            // STOP HERE if the message is from me (the bot)
            if (fromMe) {
                return;
            }

            // 4. Check Pause Status
            if (contact.is_bot_paused) {
                logger.info(`Bot is paused for contact ${phone}. Ignoring message.`);
                return;
            }

            // 5. Generate AI Response
            await this.processAIResponse(contact, messageBody);

        } catch (error) {
            logger.error('Error handling webhook', error);
        }
    }

    async processAIResponse(contact, messageBody) {
        try {
            // Fetch recent history for context (last 10 messages)
            const history = await Message.findAll({
                where: { contact_id: contact.id },
                order: [['createdAt', 'DESC']],
                limit: 10,
            });

            // Reverse to chronological order
            const chronologicalHistory = history.reverse();

            // Generate Response
            const responseText = await geminiService.generateResponse(chronologicalHistory, messageBody);

            // Send Response
            if (responseText) {
                await zapiService.sendText(contact.phone, responseText);
                await Message.create({
                    contact_id: contact.id,
                    from_me: true,
                    body: responseText,
                });
            }
        } catch (error) {
            logger.error('Error processing AI response:', error);
        }
    }
}

module.exports = new BotService();
