"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_RETRY_CONFIG = exports.MemoryIdempotencyStore = void 0;
exports.retryWithBackoff = retryWithBackoff;
exports.getRedeliveryCount = getRedeliveryCount;
exports.incrementRedeliveryCount = incrementRedeliveryCount;
const logger_1 = require("@common/logger");
const logger = (0, logger_1.createLogger)('events-reliability');
class MemoryIdempotencyStore {
    processed = new Set();
    timers = new Map();
    async isProcessed(eventId) {
        return this.processed.has(eventId);
    }
    async markProcessed(eventId, ttlSeconds = 86400) {
        this.processed.add(eventId);
        // Clean up after TTL
        const timer = setTimeout(() => {
            this.processed.delete(eventId);
            this.timers.delete(eventId);
        }, ttlSeconds * 1000);
        this.timers.set(eventId, timer);
    }
}
exports.MemoryIdempotencyStore = MemoryIdempotencyStore;
exports.DEFAULT_RETRY_CONFIG = {
    maxRetries: 3,
    initialDelayMs: 1000,
    maxDelayMs: 10000,
    backoffMultiplier: 2,
};
async function retryWithBackoff(fn, config = exports.DEFAULT_RETRY_CONFIG, attempt = 1) {
    try {
        return await fn();
    }
    catch (error) {
        if (attempt >= config.maxRetries) {
            throw error;
        }
        const delay = Math.min(config.initialDelayMs * Math.pow(config.backoffMultiplier, attempt - 1), config.maxDelayMs);
        logger.warn('Retrying after error', {
            attempt,
            maxRetries: config.maxRetries,
            delayMs: delay,
            error: error instanceof Error ? error.message : String(error),
        });
        await new Promise((resolve) => setTimeout(resolve, delay));
        return retryWithBackoff(fn, config, attempt + 1);
    }
}
function getRedeliveryCount(message) {
    const headers = message.properties.headers || {};
    return headers['x-redelivery-count'] || 0;
}
function incrementRedeliveryCount(message) {
    const headers = message.properties.headers || {};
    const count = getRedeliveryCount(message) + 1;
    headers['x-redelivery-count'] = count;
    return count;
}
//# sourceMappingURL=reliability.js.map