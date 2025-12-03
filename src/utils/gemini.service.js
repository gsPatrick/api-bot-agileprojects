const { GoogleGenerativeAI } = require('@google/generative-ai');
const logger = require('../utils/logger.utils');
require('dotenv').config();

class GeminiService {
    constructor() {
        if (process.env.GEMINI_API_KEY) {
            this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
            // Modelos disponíveis em ordem de preferência
            this.models = [
                'gemini-2.5-flash',      // Primeiro: mais recente e rápido
                'gemini-2.5-flash-lite',  // Segundo: mais leve
                'gemini-2.0-flash'       // Terceiro: versão 2.0
            ];
            this.currentModelIndex = 0;
            this.model = this.genAI.getGenerativeModel({
                model: this.models[this.currentModelIndex]
            });
        } else {
            logger.warn('GEMINI_API_KEY is not set. AI features will be disabled.');
        }
    }

    /**
     * Implementa exponential backoff para retry
     * @param {Function} fn - Função a ser executada
     * @param {number} maxRetries - Número máximo de tentativas
     * @param {number} baseDelay - Delay inicial em ms
     */
    async retryWithBackoff(fn, maxRetries = 5, baseDelay = 1000) {
        let lastError;

        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                return await fn();
            } catch (error) {
                lastError = error;

                // Verifica se é um erro 503 (overload) ou 429 (rate limit)
                const isRetryable = error.status === 503 || error.status === 429;

                if (!isRetryable || attempt === maxRetries - 1) {
                    // Se não é um erro que podemos tentar novamente, ou se esgotamos as tentativas
                    break;
                }

                // Calcula delay com exponential backoff
                const delay = baseDelay * Math.pow(2, attempt);
                const jitter = Math.random() * 1000; // Adiciona jitter para evitar thundering herd
                const totalDelay = delay + jitter;

                logger.warn(
                    `Attempt ${attempt + 1}/${maxRetries} failed with status ${error.status}. ` +
                    `Retrying in ${Math.round(totalDelay)}ms...`
                );

                await new Promise(resolve => setTimeout(resolve, totalDelay));
            }
        }

        throw lastError;
    }

    /**
     * Tenta usar um modelo alternativo se o atual falhar
     */
    async tryFallbackModel() {
        if (this.currentModelIndex < this.models.length - 1) {
            this.currentModelIndex++;
            const fallbackModel = this.models[this.currentModelIndex];
            logger.info(`Switching to fallback model: ${fallbackModel}`);
            this.model = this.genAI.getGenerativeModel({ model: fallbackModel });
            return true;
        }
        return false;
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

            // Tenta gerar resposta com retry e backoff
            const response = await this.retryWithBackoff(async () => {
                const chat = this.model.startChat({
                    history: validHistory,
                    generationConfig: {
                        maxOutputTokens: 200,
                        temperature: 0.9,
                    },
                });

                const result = await chat.sendMessage(newMessage);
                return await result.response;
            });

            return response.text();

        } catch (error) {
            logger.error('Error generating AI response:', error);

            if (error.status) {
                logger.error(`Status: ${error.status}, Message: ${error.message}`);

                // Se ainda está com erro 503 após retries, tenta modelo alternativo
                if (error.status === 503) {
                    const hasFallback = await this.tryFallbackModel();
                    if (hasFallback) {
                        logger.info('Retrying with fallback model...');
                        // Tenta novamente com o novo modelo (uma única vez)
                        try {
                            return await this.generateResponse(history, newMessage);
                        } catch (fallbackError) {
                            logger.error('Fallback model also failed:', fallbackError);
                        }
                    }
                }
            }

            // Se tudo falhar, retorna null ou mensagem amigável
            return null;
        }
    }
}

module.exports = new GeminiService();