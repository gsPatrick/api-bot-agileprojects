const { GoogleGenerativeAI } = require('@google/generative-ai');
const logger = require('../utils/logger.utils');
require('dotenv').config();

class GeminiService {
    constructor() {
        if (process.env.GEMINI_API_KEY) {
            this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
            this.models = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'];
        } else {
            logger.warn('GEMINI_API_KEY is not set. AI features will be disabled.');
        }
    }

    async sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async generateResponse(history, newMessage) {
        if (!this.genAI) {
            return 'Desculpe, meu sistema de IA não está configurado no momento.';
        }

        // Sanitize history
        let validHistory = history.map(msg => ({
            role: msg.from_me ? 'model' : 'user',
            parts: [{ text: msg.body }],
        }));

        while (validHistory.length > 0 && validHistory[0].role === 'model') {
            validHistory.shift();
        }

        for (const modelName of this.models) {
            try {
                logger.info(`Attempting to generate response using model: ${modelName}`);
                const model = this.genAI.getGenerativeModel({ model: modelName });

                const response = await this.retryOperation(async () => {
                    const chat = model.startChat({
                        history: validHistory,
                        generationConfig: {
                            maxOutputTokens: 200,
                            temperature: 0.9,
                        },
                    });
                    const result = await chat.sendMessage(newMessage);
                    const response = await result.response;
                    return response.text();
                });

                return response;
            } catch (error) {
                logger.warn(`Failed to generate response with model ${modelName}: ${error.message}`);
                // Continue to next model if available
            }
        }

        logger.error('All models failed to generate a response.');
        return null;
    }

    async retryOperation(operation, maxRetries = 3, initialDelay = 1000) {
        let lastError;

        for (let i = 0; i < maxRetries; i++) {
            try {
                return await operation();
            } catch (error) {
                lastError = error;

                // Don't retry if it's a client error (4xx) unless it's 429 (Too Many Requests)
                if (error.status && error.status >= 400 && error.status < 500 && error.status !== 429) {
                    throw error;
                }

                const delay = initialDelay * Math.pow(2, i);
                logger.info(`Retry attempt ${i + 1}/${maxRetries} after ${delay}ms due to error: ${error.message}`);
                await this.sleep(delay);
            }
        }

        throw lastError;
    }
}

module.exports = new GeminiService();