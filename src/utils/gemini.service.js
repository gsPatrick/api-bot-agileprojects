const { GoogleGenerativeAI } = require('@google/generative-ai');
const logger = require('../utils/logger.utils');
require('dotenv').config();

class GeminiService {
    constructor() {
        if (process.env.GEMINI_API_KEY) {
            this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
            // Use o modelo correto e disponível no tier gratuito
            this.model = this.genAI.getGenerativeModel({
                model: 'gemini-1.5-flash-latest' // ou 'gemini-pro'
            });
        } else {
            logger.warn('GEMINI_API_KEY is not set. AI features will be disabled.');
        }
    }

    async generateResponse(history, newMessage) {
        if (!this.model) {
            return 'Desculpe, meu sistema de IA não está configurado no momento.';
        }

        try {
            // Sanitize history: Ensure the first message is from 'user'
            let validHistory = history.map(msg => ({
                role: msg.from_me ? 'model' : 'user',
                parts: [{ text: msg.body }],
            }));

            // Remove mensagens do 'model' no início
            while (validHistory.length > 0 && validHistory[0].role === 'model') {
                validHistory.shift();
            }

            const chat = this.model.startChat({
                history: validHistory,
                generationConfig: {
                    maxOutputTokens: 200,
                    temperature: 0.9, // Adicione configurações opcionais
                },
            });

            const result = await chat.sendMessage(newMessage);
            const response = await result.response;
            return response.text();
        } catch (error) {
            logger.error('Error generating AI response:', error);

            // Log mais detalhado para debug
            if (error.status) {
                logger.error(`Status: ${error.status}, Message: ${error.message}`);
            }

            return null;
        }
    }
}

module.exports = new GeminiService();