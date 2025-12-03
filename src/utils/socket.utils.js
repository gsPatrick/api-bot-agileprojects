const socketIo = require('socket.io');
const logger = require('./logger.utils');

let io;

const init = (server) => {
    io = socketIo(server, {
        cors: {
            origin: "*", // Allow all origins for now, restrict in production
            methods: ["GET", "POST"]
        }
    });

    io.on('connection', (socket) => {
        logger.info(`New client connected: ${socket.id}`);

        socket.on('disconnect', () => {
            logger.info(`Client disconnected: ${socket.id}`);
        });
    });

    return io;
};

const getIo = () => {
    if (!io) {
        throw new Error('Socket.io not initialized!');
    }
    return io;
};

module.exports = {
    init,
    getIo
};
