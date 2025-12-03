const { GoogleGenerativeAI } = require('@google/generative-ai');
const logger = require('../utils/logger.utils');
require('dotenv').config();

class GeminiService {
    constructor() {
        if (process.env.GEMINI_API_KEY) {
            this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
            this.model = this.genAI.getGenerativeModel({ model: 'gemini-pro' });
        } else {
            logger.warn('GEMINI_API_KEY is not set. AI features will be disabled.');
        }
    }

    async generateResponse(history, newMessage) {
        if (!this.model) {
            return 'Desculpe, meu sistema de IA não está configurado no momento.';
        }

        try {
            const chat = this.model.startChat({
                history: history.map(msg => ({
                    role: msg.from_me ? 'model' : 'user',
                    parts: [{ text: msg.body }],
                })),
                generationConfig: {
                    maxOutputTokens: 200,
                },
            });

            const result = await chat.sendMessage(newMessage);
            const response = await result.response;
            return response.text();
        } catch (error) {
            logger.error('Error generating AI response:', error);
            return 'Desculpe, estou tendo dificuldades para processar sua mensagem agora.';
        }
    }
}

module.exports = new GeminiService();
