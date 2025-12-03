const botService = require('./bot.service');
const response = require('../../utils/response.utils');

class BotController {
    async handleWebhook(req, res) {
        try {
            // Z-API sends events. We are interested in 'on-message-received' usually, 
            // but the payload structure depends on how Z-API is configured.
            // Assuming the body contains the message data directly or wrapped.
            // We'll pass the whole body to the service to parse.

            // Important: Return 200 OK immediately to Z-API to avoid retries.
            // Processing can happen asynchronously if needed, but for now we await it.

            await botService.handleWebhook(req.body);

            return response.success(res, null, 'Webhook received', 200);
        } catch (error) {
            // Even on error, we might want to return 200 to Z-API so it stops retrying bad webhooks,
            // but logging it is crucial.
            return response.error(res, error.message, 500);
        }
    }
}

module.exports = new BotController();
