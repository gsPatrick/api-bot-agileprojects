const { Contact, Message } = require('../../models');
const zapiService = require('../../utils/zapi.service');
const logger = require('../../utils/logger.utils');

class BotService {
    async handleWebhook(data) {
        try {
            // Basic validation for Z-API webhook structure
            if (data.type === 'PresenceChatCallback' || data.type === 'MessageStatusCallback') {
                // Ignore presence and status updates
                return;
            }

            if (!data.phone || !data.text || !data.text.message) {
                logger.warn('Invalid webhook data', data);
                return;
            }

            const phone = data.phone;
            const messageBody = data.text.message;
            const contactName = data.name || 'Unknown';

            // 1. Find or Create Contact
            let [contact, created] = await Contact.findOrCreate({
                where: { phone },
                defaults: {
                    name: contactName,
                    flow_step: 'NEW',
                    flow_data: {},
                    last_interaction: new Date(),
                },
            });

            // 2. Save Incoming Message
            await Message.create({
                contact_id: contact.id,
                from_me: false,
                body: messageBody,
            });

            // 3. Check Pause Status
            if (contact.is_bot_paused) {
                logger.info(`Bot is paused for contact ${phone}. Ignoring message.`);
                return;
            }

            // 4. State Machine
            await this.processFlow(contact, messageBody);

        } catch (error) {
            logger.error('Error handling webhook', error);
        }
    }

    async processFlow(contact, messageBody) {
        let nextStep = contact.flow_step;
        let responseText = '';
        let flowData = { ...contact.flow_data };

        switch (contact.flow_step) {
            case 'NEW':
                responseText = 'Olá! Bem-vindo. Você precisa mais de: (1) um site que te represente, (2) vender produtos online, ou (3) automatizar atendimentos?';
                nextStep = 'TRIAGE_1';
                break;

            case 'TRIAGE_1':
                flowData.goal = messageBody;
                responseText = 'Entendi. Tem site hoje?';
                nextStep = 'TRIAGE_2';
                break;

            case 'TRIAGE_2':
                flowData.has_site = messageBody;
                responseText = 'Já vende online?';
                nextStep = 'TRIAGE_3';
                break;

            case 'TRIAGE_3':
                flowData.sells_online = messageBody;
                responseText = 'Quantos produtos tem?';
                nextStep = 'TRIAGE_4';
                break;

            case 'TRIAGE_4':
                flowData.product_count = messageBody;
                responseText = 'Quer agendamentos ou vendas?';
                nextStep = 'OFFER';
                break;

            case 'OFFER':
                flowData.preference = messageBody;
                responseText = 'Tenho duas opções para você: Receber proposta agora ou Agendar uma call rápida.';
                nextStep = 'CLOSING';
                break;

            case 'CLOSING':
                flowData.closing_choice = messageBody;
                responseText = 'Tenho vagas de entrega ainda esse mês. Quer que eu envie sua proposta primeiro?';
                // Stay in CLOSING or move to END, for now let's keep it open or maybe 'DONE'
                // nextStep = 'DONE'; 
                break;

            default:
                // If flow is done or unknown, maybe just echo or do nothing
                // responseText = 'Posso ajudar em algo mais?';
                return;
        }

        // Update Contact State
        await contact.update({
            flow_step: nextStep,
            flow_data: flowData,
            last_interaction: new Date(),
        });

        // Send Response
        if (responseText) {
            await zapiService.sendText(contact.phone, responseText);
            await Message.create({
                contact_id: contact.id,
                from_me: true,
                body: responseText,
            });
        }
    }
}

module.exports = new BotService();
