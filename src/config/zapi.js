require('dotenv').config();

module.exports = {
    instanceId: process.env.ZAPI_INSTANCE_ID,
    token: process.env.ZAPI_TOKEN,
    baseUrl: 'https://api.z-api.io/instances',
};
