"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getConnection = getConnection;
exports.getChannel = getChannel;
exports.closeConnection = closeConnection;
const amqp = __importStar(require("amqp-connection-manager"));
const env_1 = require("@common/env");
const logger_1 = require("@common/logger");
const types_1 = require("./types");
const logger = (0, logger_1.createLogger)('events');
let connection = null;
let channelWrapper = null;
async function getConnection() {
    if (connection) {
        return connection;
    }
    const env = (0, env_1.getEnv)();
    const url = env.RABBITMQ_URL || `amqp://${env.RABBITMQ_USER}:${env.RABBITMQ_PASSWORD}@${env.RABBITMQ_HOST}:${env.RABBITMQ_PORT}`;
    connection = amqp.connect([url], {
        reconnectTimeInSeconds: 5,
    });
    connection.on('connect', () => {
        logger.info('Connected to RabbitMQ');
    });
    connection.on('disconnect', (params) => {
        const error = params?.err instanceof Error ? params.err.message : String(params?.err || 'Unknown error');
        logger.warn('Disconnected from RabbitMQ', { error });
    });
    connection.on('connectFailed', (params) => {
        const error = params?.err instanceof Error ? params.err.message : String(params?.err || 'Unknown error');
        logger.error('Failed to connect to RabbitMQ', { error });
    });
    return connection;
}
async function getChannel() {
    if (channelWrapper) {
        return channelWrapper;
    }
    const conn = await getConnection();
    channelWrapper = conn.createChannel({
        setup: async (channel) => {
            await channel.assertExchange(types_1.EXCHANGE_NAME, types_1.EXCHANGE_TYPE, {
                durable: true,
            });
            logger.info(`Exchange '${types_1.EXCHANGE_NAME}' asserted`);
        },
    });
    return channelWrapper;
}
async function closeConnection() {
    if (channelWrapper) {
        await channelWrapper.close();
        channelWrapper = null;
    }
    if (connection) {
        await connection.close();
        connection = null;
    }
}
//# sourceMappingURL=connection.js.map