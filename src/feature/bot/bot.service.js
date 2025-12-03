const { Contact, Message, LeadProfile } = require('../../models');
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
            logger.info(`[PAUSE CHECK] Contact ${phone} is_bot_paused: ${contact.is_bot_paused} (Type: ${typeof contact.is_bot_paused})`);

            if (contact.is_bot_paused) {
                logger.info(`Bot is paused for contact ${phone}. Ignoring message.`);
                return;
            }

            // DEBUG: Log current flow step
            logger.info(`Processing message for contact ${phone}. Current Flow Step: ${contact.flow_step}`);

            // RESET COMMAND FOR TESTING
            if (messageBody.trim().toLowerCase() === '#reset') {
                await contact.update({
                    flow_step: 'NEW',
                    flow_data: {}
                });
                await zapiService.sendText(contact.phone, "Fluxo reiniciado. Envie 'Ola' para começar.");
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
        let nextStep = step; // Default: fica no mesmo passo se der erro
        let responseText = null;
        let isButtonResponse = false; // Flag para saber se usa sendButtonList ou sendText
        let buttonList = [];

        // Helper para normalizar texto
        const lowerBody = messageBody ? messageBody.trim().toLowerCase() : '';

        // Helper para atualizar ou criar o perfil
        const updateProfile = async (contactId, data) => {
            const [profile] = await LeadProfile.findOrCreate({
                where: { contact_id: contactId },
                defaults: data
            });
            await profile.update(data);
        };

        logger.info(`Processing Flow Step: ${step} for ${contact.phone}. Message: ${messageBody}`);

        try {
            switch (step) {
                case 'NEW':
                    // CASE: 'NEW' (Início do Fluxo)
                    // Comportamento: Não valida entrada. Apenas envia a mensagem inicial com botões.

                    isButtonResponse = true;
                    responseText = "Olá! Sou o assistente virtual da AgileProjects. Selecione abaixo o que sua empresa mais precisa hoje:";
                    buttonList = [
                        { id: '1', label: 'Site Profissional' },
                        { id: '2', label: 'E-commerce' },
                        { id: '3', label: 'Sistemas' }
                    ];

                    // Ação: Atualizar DB: flow_step = 'TRIAGE'.
                    // IMPORTANTE: Aqui salvamos o próximo passo IMEDIATAMENTE pois não estamos validando input do usuário
                    await contact.update({ flow_step: 'TRIAGE' });
                    break;

                case 'TRIAGE':
                    // CASE: 'TRIAGE' (Validação da Escolha do Botão)
                    // Validação: O texto deve conter "Site", "Commerce", "Sistemas", "1", "2" ou "3".
                    const validTriage = ['site', 'commerce', 'sistemas', '1', '2', '3', 'profissional', 'loja'];
                    const isTriageValid = validTriage.some(opt => lowerBody.includes(opt));

                    if (!isTriageValid) {
                        await zapiService.sendText(contact.phone, "Por favor, clique em um dos botões acima ou digite a opção.");
                        return; // PAUSA AQUI (Loop)
                    }

                    // Ação (Sucesso):
                    await updateProfile(contact.id, { interest: messageBody, score: 20 });
                    await contact.update({ flow_step: 'QUALIFY_SITE' });

                    responseText = "Entendi! Para começarmos, você já possui um site no ar hoje?";
                    break;

                case 'QUALIFY_SITE':
                    // CASE: 'QUALIFY_SITE' (Validação Sim/Não)
                    // Validação: O texto deve ser "Sim", "Não", "S", "N" (case insensitive).
                    const validSite = ['sim', 'não', 'nao', 's', 'n'];
                    const isSiteValid = validSite.includes(lowerBody) || validSite.some(v => lowerBody.startsWith(v));

                    if (!isSiteValid) {
                        await zapiService.sendText(contact.phone, "Resposta inválida. Por favor, responda apenas com 'Sim' ou 'Não'.");
                        return;
                    }

                    // Ação (Sucesso):
                    await updateProfile(contact.id, { has_site: messageBody });
                    // Incrementa score (opcional, lógica de exemplo)
                    await contact.update({ flow_step: 'QUALIFY_ONLINE' });

                    responseText = "Certo. E você já realiza vendas online atualmente?";
                    break;

                case 'QUALIFY_ONLINE':
                    // CASE: 'QUALIFY_ONLINE' (Validação Sim/Não)
                    const validOnline = ['sim', 'não', 'nao', 's', 'n'];
                    const isOnlineValid = validOnline.includes(lowerBody) || validOnline.some(v => lowerBody.startsWith(v));

                    if (!isOnlineValid) {
                        await zapiService.sendText(contact.phone, "Por favor, responda com 'Sim' ou 'Não'.");
                        return;
                    }

                    // Ação (Sucesso):
                    await updateProfile(contact.id, { sells_online: messageBody });
                    await contact.update({ flow_step: 'QUALIFY_PRODUCTS' });

                    responseText = "Legal. Quantos produtos/serviços você tem aproximadamente? (Digite apenas o número, ex: 50)";
                    break;

                case 'QUALIFY_PRODUCTS':
                    // CASE: 'QUALIFY_PRODUCTS' (Validação Numérica)
                    // Validação: O texto deve conter números (Regex /\d+/).
                    const hasNumber = /\d+/.test(messageBody);

                    if (!hasNumber) {
                        await zapiService.sendText(contact.phone, "Não entendi a quantidade. Por favor, digite um número aproximado (ex: 10, 100).");
                        return;
                    }

                    // Ação (Sucesso):
                    await updateProfile(contact.id, { product_count: messageBody });
                    await contact.update({ flow_step: 'QUALIFY_GOAL' });

                    responseText = "O que é mais importante para você agora: focar em 'Agendamentos' ou 'Vendas Diretas'?";
                    break;

                case 'QUALIFY_GOAL':
                    // CASE: 'QUALIFY_GOAL' (Validação de Texto Específico)
                    // Validação: O texto deve conter "Agendamento", "Agenda", "Venda" ou "Direta".
                    const validGoal = ['agendamento', 'agenda', 'venda', 'direta'];
                    const isGoalValid = validGoal.some(opt => lowerBody.includes(opt));

                    if (!isGoalValid) {
                        await zapiService.sendText(contact.phone, "Opção não reconhecida. Responda com 'Agendamentos' ou 'Vendas'.");
                        return;
                    }

                    // Ação (Sucesso):
                    await updateProfile(contact.id, { main_goal: messageBody });
                    await contact.update({ flow_step: 'OFFER' });

                    responseText = "Perfeito. Tenho uma proposta ideal para seu perfil.\n\nVocê prefere:\n1. Receber a proposta por PDF aqui\n2. Agendar uma reunião rápida\n\n(Digite 1 ou 2)";
                    break;

                case 'OFFER':
                    // CASE: 'OFFER' (Validação 1 ou 2)
                    // Validação: O texto deve ser "1" ou "2".
                    const validOffer = ['1', '2'];
                    const isOfferValid = validOffer.includes(lowerBody);

                    if (!isOfferValid) {
                        await zapiService.sendText(contact.phone, "Digite apenas o número 1 ou 2.");
                        return;
                    }

                    // Ação (Sucesso):
                    await updateProfile(contact.id, { offer_choice: messageBody });
                    await contact.update({ flow_step: 'CLOSING' });

                    responseText = "Combinado! Um de nossos especialistas já recebeu seu perfil e entrará em contato em instantes.";

                    // Logar no console o perfil completo do cliente
                    const finalProfile = await LeadProfile.findOne({ where: { contact_id: contact.id } });
                    logger.info(`[FULL PROFILE COLLECTED] Contact: ${contact.phone}, Data: ${JSON.stringify(finalProfile, null, 2)}`);
                    break;

                case 'CLOSING':
                    // CASE: 'CLOSING' (Fim do Fluxo)
                    // Se o cliente mandar mensagem aqui, apenas responda: "Seu cadastro já foi realizado..."
                    responseText = "Seu cadastro já foi realizado. Em breve entraremos em contato!";
                    break;

                default:
                    // Fallback para segurança, reseta para NEW
                    logger.warn(`Unknown step ${step}, resetting to NEW`);
                    await contact.update({ flow_step: 'NEW' });
                    // Recursive call to start over immediately? Or just let them send another message?
                    // Let's just return and let the next message trigger NEW logic or send a prompt.
                    responseText = "Ocorreu um erro no fluxo. Digite 'Ola' para reiniciar.";
                    break;
            }

            // Envio da resposta (Se não tiver dado return antes)
            if (responseText) {
                if (isButtonResponse) {
                    await zapiService.sendButtonList(contact.phone, responseText, buttonList);
                } else {
                    await zapiService.sendText(contact.phone, responseText);
                }

                // Salvar mensagem do bot no banco (Message.create...)
                const savedBotMessage = await Message.create({
                    contact_id: contact.id,
                    from_me: true,
                    body: responseText,
                });

                // Emitir socket (io.emit...)
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

        } catch (err) {
            logger.error('Error in processFlow:', err);
        }
    }

    // AI METHOD REMOVED/UNUSED
    // async processAIResponse(contact, messageBody) {
    //     logger.info(`Processing AI Response for contact ${contact.phone}`);
    //     try {
    //         // Fetch recent history for context (last 10 messages)
    //         const history = await Message.findAll({
    //             where: { contact_id: contact.id },
    //             order: [['createdAt', 'DESC']],
    //             limit: 10,
    //         });

    //         // Reverse to chronological order
    //         const chronologicalHistory = history.reverse();

    //         // Generate Response
    //         const responseText = await geminiService.generateResponse(chronologicalHistory, messageBody);

    //         logger.info(`Gemini Response: ${responseText}`);

    //         // Send Response
    //         if (responseText) {
    //             await zapiService.sendText(contact.phone, responseText);
    //             const savedBotMessage = await Message.create({
    //                 contact_id: contact.id,
    //                 from_me: true,
    //                 body: responseText,
    //             });

    //             // Emit Socket Event
    //             try {
    //                 const io = socketUtils.getIo();
    //                 io.emit('message_sent', {
    //                     contact: contact,
    //                     message: savedBotMessage
    //                 });
    //             } catch (err) {
    //                 logger.warn('Socket.io not initialized or failed to emit message_sent');
    //             }
    //         }
    //     } catch (error) {
    //         logger.error('Error processing AI response:', error);
    //     }
    // }
}

module.exports = new BotService();
