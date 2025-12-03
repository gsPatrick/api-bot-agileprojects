const { Contact, Message } = require('../../models');
const zapiService = require('../../utils/zapi.service');
const geminiService = require('../../utils/gemini.service');
const logger = require('../../utils/logger.utils');
const socketUtils = require('../../utils/socket.utils');

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
                return;
            }

            const phone = data.phone;
            const messageBody = data.text.message;
            const fromMe = data.fromMe || false;

            // Fetch latest contact info from Z-API if it's an incoming message (or if we want to refresh)
            let contactName = data.name || 'Unknown';
            let contactPic = data.profilePicUrl || null;

            // Try to use chatName if available (often better for groups or specific contacts)
            if (data.chatName) {
                contactName = data.chatName;
            }

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
            // CHANGED: Default flow_step is now 'NEW' instead of 'AI_CHAT'
            let [contact, created] = await Contact.findOrCreate({
                where: { phone },
                defaults: {
                    name: contactName,
                    pic_url: contactPic,
                    flow_step: 'NEW',
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
            const savedMessage = await Message.create({
                contact_id: contact.id,
                from_me: fromMe,
                body: messageBody,
            });

            // Emit Socket Event
            try {
                const io = socketUtils.getIo();
                io.emit('message_received', {
                    contact: contact,
                    message: savedMessage
                });
            } catch (err) {
                logger.warn('Socket.io not initialized or failed to emit message_received');
            }

            // STOP HERE if the message is from me (the bot)
            if (fromMe) {
                return;
            }

            // 4. Check Pause Status
            if (contact.is_bot_paused) {
                logger.info(`Bot is paused for contact ${phone}. Ignoring message.`);
                return;
            }

            // 5. SDR Sales Flow State Machine
            await this.processFlow(contact, messageBody);

        } catch (error) {
            logger.error('Error handling webhook', error);
        }
    }

    async processFlow(contact, messageBody) {
        const step = contact.flow_step;
        let nextStep = step;
        let responseText = null;
        let updateData = {};

        try {
            switch (step) {
                case 'NEW':
                    // Step 0: Send Welcome Message & Triage Question
                    responseText = "Olá! Sou o assistente virtual da AgileProjects.\n\nPara começarmos, você precisa mais de:\n(1) Um site que te represente\n(2) Vender produtos online\n(3) Automatizar atendimentos?";
                    nextStep = 'TRIAGE';
                    break;

                case 'TRIAGE':
                    // Step 1: Save answer (1, 2, or 3) and ask "Tem site hoje?"
                    updateData = { triage_option: messageBody };
                    responseText = "Entendi! E você já tem um site hoje?";
                    nextStep = 'QUALIFY_SITE';
                    break;

                case 'QUALIFY_SITE':
                    // Step 2: Save answer and ask "Já vende online?"
                    updateData = { has_site: messageBody };
                    responseText = "Certo. E você já vende online atualmente?";
                    nextStep = 'QUALIFY_ONLINE';
                    break;

                case 'QUALIFY_ONLINE':
                    // Step 3: Save answer and ask "Quantos produtos tem?"
                    updateData = { sells_online: messageBody };
                    responseText = "Legal. Quantos produtos você tem aproximadamente?";
                    nextStep = 'QUALIFY_PRODUCTS';
                    break;

                case 'QUALIFY_PRODUCTS':
                    // Step 4: Save answer and ask "Quer agendamentos ou vendas?"
                    updateData = { product_count: messageBody };
                    responseText = "O que é mais importante para você agora: agendamentos ou vendas diretas?";
                    nextStep = 'QUALIFY_GOAL';
                    break;

                case 'QUALIFY_GOAL':
                    // Step 5: Save answer and Offer Options
                    updateData = { main_goal: messageBody };
                    responseText = "Perfeito. Tenho 2 caminhos para você:\n1. Receber uma proposta agora\n2. Agendar uma call rápida para entendermos melhor.\n\nQual prefere?";
                    nextStep = 'OFFER';
                    break;

                case 'OFFER':
                    // Step 6: Save answer and Final Message
                    updateData = { offer_choice: messageBody };
                    responseText = "Ótimo! Tenho vagas de entrega ainda esse mês. Quer que eu envie sua proposta primeiro?";
                    nextStep = 'CLOSING';
                    break;

                case 'CLOSING':
                    // Step 7: Save answer, Notify Admin, and switch to AI_CHAT
                    updateData = { closing_response: messageBody };

                    // Notify Admin (Log/Console as requested)
                    const finalData = { ...contact.flow_data, ...updateData };
                    logger.info(`[LEAD COMPLETED] Contact: ${contact.phone}, Name: ${contact.name}, Data: ${JSON.stringify(finalData)}`);

                    // You might want to send a confirmation to the user here, or just let Gemini take over.
                    // The prompt says: "From now on, use geminiService to answer any further questions contextually."
                    // But we should probably acknowledge the closing step.
                    // Let's send a transition message or just let Gemini handle the next input?
                    // "Step 7 (CLOSING / COMPLETED): Save answer. Notify Admin. Set flow_step to AI_CHAT."
                    // It doesn't explicitly say to send a message *here*, but usually you'd want to close the loop.
                    // However, if I set it to AI_CHAT, the *next* message will trigger Gemini.
                    // But wait, the user just sent a message answering "Quer que eu envie sua proposta primeiro?".
                    // If I don't reply, it feels weird.
                    // But the prompt says: "The AI (Gemini) should ONLY be used if the flow is completed..."
                    // If I switch to AI_CHAT now, I should probably generate a response immediately?
                    // Or just acknowledge.
                    // Let's assume we should acknowledge and then switch.
                    responseText = "Perfeito! Um de nossos especialistas vai entrar em contato em breve. Se tiver mais dúvidas, pode perguntar aqui que eu te ajudo!";
                    nextStep = 'AI_CHAT';
                    break;

                case 'AI_CHAT':
                    // Fallback to Gemini
                    await this.processAIResponse(contact, messageBody);
                    return; // Exit here, processAIResponse handles sending

                default:
                    // Fallback if state is unknown, maybe reset to NEW or go to AI?
                    // Let's assume AI_CHAT for safety if unknown
                    logger.warn(`Unknown flow step ${step} for contact ${contact.phone}. Defaulting to AI.`);
                    await this.processAIResponse(contact, messageBody);
                    return;
            }

            // Execute State Transition
            if (responseText) {
                // 1. Send Message
                await zapiService.sendText(contact.phone, responseText);

                // 2. Save Bot Message
                const savedBotMessage = await Message.create({
                    contact_id: contact.id,
                    from_me: true,
                    body: responseText,
                });

                // 3. Emit Socket Event
                try {
                    const io = socketUtils.getIo();
                    io.emit('message_sent', {
                        contact: contact,
                        message: savedBotMessage
                    });
                } catch (err) {
                    logger.warn('Socket.io not initialized or failed to emit message_sent');
                }

                // 4. Update Contact State
                const newFlowData = { ...contact.flow_data, ...updateData };
                await contact.update({
                    flow_step: nextStep,
                    flow_data: newFlowData
                });
            }

        } catch (err) {
            logger.error('Error in processFlow:', err);
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
                const savedBotMessage = await Message.create({
                    contact_id: contact.id,
                    from_me: true,
                    body: responseText,
                });

                // Emit Socket Event
                try {
                    const io = socketUtils.getIo();
                    io.emit('message_sent', {
                        contact: contact,
                        message: savedBotMessage
                    });
                } catch (err) {
                    logger.warn('Socket.io not initialized or failed to emit message_sent');
                }
            }
        } catch (error) {
            logger.error('Error processing AI response:', error);
        }
    }
}

module.exports = new BotService();
