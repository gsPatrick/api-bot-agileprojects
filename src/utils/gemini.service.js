const { GoogleGenerativeAI } = require('@google/generative-ai');
const logger = require('../utils/logger.utils');
require('dotenv').config();

class GeminiService {
    constructor() {
        if (process.env.GEMINI_API_KEY) {
            this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
            // Use gemini-1.5-flash which is generally available and faster
            this.model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
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
            // Gemini requires the conversation to start with a user message.
            let validHistory = history.map(msg => ({
                role: msg.from_me ? 'model' : 'user',
                parts: [{ text: msg.body }],
            }));

            // If history exists and starts with 'model', remove the first item until it starts with 'user' or is empty
            while (validHistory.length > 0 && validHistory[0].role === 'model') {
                validHistory.shift();
            }

            const chat = this.model.startChat({
                history: validHistory,
                generationConfig: {
                    maxOutputTokens: 200,
                },
            });

            const result = await chat.sendMessage(newMessage);
            const response = await result.response;
            return response.text();
        } catch (error) {
            logger.error('Error generating AI response:', error);
            // Return null or a fallback to avoid crashing or sending error text to user
            return null;
        }
    }
}

module.exports = new GeminiService();
