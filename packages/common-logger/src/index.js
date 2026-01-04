"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Logger = void 0;
exports.createLogger = createLogger;
exports.getLogger = getLogger;
const winston_1 = __importDefault(require("winston"));
const env_1 = require("@common/env");
class Logger {
    logger;
    constructor(serviceName) {
        const env = (0, env_1.getEnv)();
        const isProduction = env.NODE_ENV === 'production';
        const logLevel = (env.LOG_LEVEL || 'info');
        const format = winston_1.default.format.combine(winston_1.default.format.timestamp(), winston_1.default.format.errors({ stack: true }), isProduction
            ? winston_1.default.format.json()
            : winston_1.default.format.combine(winston_1.default.format.colorize(), winston_1.default.format.printf(({ timestamp, level, message, ...meta }) => {
                const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
                return `${timestamp} [${level}]: ${message} ${metaStr}`;
            })));
        this.logger = winston_1.default.createLogger({
            level: logLevel,
            format,
            defaultMeta: {
                service: serviceName || env.SERVICE_NAME || 'unknown',
            },
            transports: [
                new winston_1.default.transports.Console({
                    stderrLevels: ['error'],
                }),
            ],
        });
    }
    error(message, context) {
        this.logger.error(message, context);
    }
    warn(message, context) {
        this.logger.warn(message, context);
    }
    info(message, context) {
        this.logger.info(message, context);
    }
    debug(message, context) {
        this.logger.debug(message, context);
    }
    child(context) {
        const childLogger = new Logger();
        childLogger.logger = this.logger.child(context);
        return childLogger;
    }
}
exports.Logger = Logger;
let defaultLogger = null;
function createLogger(serviceName) {
    return new Logger(serviceName);
}
function getLogger() {
    if (!defaultLogger) {
        defaultLogger = createLogger();
    }
    return defaultLogger;
}
//# sourceMappingURL=index.js.map