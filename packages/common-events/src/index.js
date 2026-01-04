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
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.closeConnection = exports.EventConsumer = exports.EventPublisher = void 0;
exports.createEventId = createEventId;
const connection_1 = require("./connection");
Object.defineProperty(exports, "closeConnection", { enumerable: true, get: function () { return connection_1.closeConnection; } });
const logger_1 = require("@common/logger");
const types_1 = require("./types");
const reliability_1 = require("./reliability");
const logger = (0, logger_1.createLogger)('events');
class EventPublisher {
    async publish(routingKey, event, correlationId, causationId) {
        try {
            const channel = await (0, connection_1.getChannel)();
            // Add correlation IDs if provided
            const eventWithIds = {
                ...event,
                correlationId: correlationId || event.correlationId,
                causationId: causationId || event.causationId || event.eventId,
            };
            const message = Buffer.from(JSON.stringify(eventWithIds));
            await channel.publish(types_1.EXCHANGE_NAME, routingKey, message, {
                persistent: true,
                messageId: event.eventId,
                timestamp: Date.now(),
                type: event.eventType,
                correlationId: eventWithIds.correlationId,
                headers: {
                    'x-correlation-id': eventWithIds.correlationId,
                    'x-causation-id': eventWithIds.causationId,
                },
            });
            logger.debug('Event published', {
                routingKey,
                eventType: event.eventType,
                eventId: event.eventId,
                correlationId: eventWithIds.correlationId,
                causationId: eventWithIds.causationId,
            });
        }
        catch (error) {
            logger.error('Failed to publish event', {
                routingKey,
                eventType: event.eventType,
                error: error instanceof Error ? error.message : String(error),
            });
            throw error;
        }
    }
}
exports.EventPublisher = EventPublisher;
class EventConsumer {
    queueName;
    dlqName;
    handlers = new Map();
    idempotencyStore;
    retryConfig;
    constructor(queueName, options) {
        this.queueName = queueName;
        this.dlqName = `${queueName}.dlq`;
        this.idempotencyStore = options?.idempotencyStore || new reliability_1.MemoryIdempotencyStore();
        this.retryConfig = options?.retryConfig || reliability_1.DEFAULT_RETRY_CONFIG;
    }
    async start() {
        try {
            const channel = await (0, connection_1.getChannel)();
            await channel.addSetup(async (ch) => {
                // Assert main queue
                await ch.assertQueue(this.queueName, {
                    durable: true,
                    arguments: {
                        'x-dead-letter-exchange': types_1.EXCHANGE_NAME,
                        'x-dead-letter-routing-key': this.dlqName,
                    },
                });
                // Assert DLQ
                await ch.assertQueue(this.dlqName, {
                    durable: true,
                });
                logger.info(`Queue '${this.queueName}' and DLQ '${this.dlqName}' asserted`);
                await ch.consume(this.queueName, async (message) => {
                    if (!message) {
                        return;
                    }
                    try {
                        const event = JSON.parse(message.content.toString());
                        // Fast-path idempotency check (optional optimization)
                        // Handlers should also implement atomic idempotency for defense in depth
                        const isProcessed = await this.idempotencyStore.isProcessed(event.eventId);
                        if (isProcessed) {
                            logger.info('Event already processed, skipping', {
                                eventId: event.eventId,
                                eventType: event.eventType,
                                correlationId: event.correlationId,
                            });
                            ch.ack(message);
                            return;
                        }
                        const handler = this.handlers.get(event.eventType);
                        if (!handler) {
                            logger.warn('No handler found for event type', {
                                eventType: event.eventType,
                                queueName: this.queueName,
                            });
                            ch.nack(message, false, true); // Requeue for retry
                            return;
                        }
                        // Process with retry
                        // Handlers should implement atomic idempotency (insert processed_events in same transaction)
                        // If handler throws 'EVENT_ALREADY_PROCESSED', we ACK without retry
                        try {
                            await (0, reliability_1.retryWithBackoff)(async () => {
                                await handler(event, message);
                            }, this.retryConfig);
                            // Mark as processed (backup, handlers should do this atomically)
                            await this.idempotencyStore.markProcessed(event.eventId);
                            ch.ack(message);
                        }
                        catch (handlerError) {
                            // If handler indicates event already processed, ACK without retry
                            if (handlerError?.message === 'EVENT_ALREADY_PROCESSED') {
                                logger.info('Event already processed by handler, ACKing', {
                                    eventId: event.eventId,
                                    eventType: event.eventType,
                                });
                                ch.ack(message);
                                return;
                            }
                            // Re-throw to trigger retry/DLQ
                            throw handlerError;
                        }
                        logger.debug('Event processed successfully', {
                            eventId: event.eventId,
                            eventType: event.eventType,
                            correlationId: event.correlationId,
                        });
                    }
                    catch (error) {
                        const redeliveryCount = (0, reliability_1.incrementRedeliveryCount)(message);
                        if (redeliveryCount >= this.retryConfig.maxRetries) {
                            // Send to DLQ
                            logger.error('Max retries exceeded, sending to DLQ', {
                                eventId: message.properties.messageId,
                                queueName: this.queueName,
                                dlqName: this.dlqName,
                                redeliveryCount,
                                error: error instanceof Error ? error.message : String(error),
                            });
                            await ch.sendToQueue(this.dlqName, message.content, {
                                persistent: true,
                                headers: message.properties.headers,
                            });
                            ch.ack(message); // Remove from main queue
                        }
                        else {
                            // Requeue for retry
                            logger.warn('Error processing event, requeuing', {
                                eventId: message.properties.messageId,
                                queueName: this.queueName,
                                redeliveryCount,
                                maxRetries: this.retryConfig.maxRetries,
                                error: error instanceof Error ? error.message : String(error),
                            });
                            ch.nack(message, false, true);
                        }
                    }
                }, {
                    noAck: false,
                });
                logger.info(`Started consuming from queue '${this.queueName}'`);
            });
        }
        catch (error) {
            logger.error('Failed to start consumer', {
                queueName: this.queueName,
                error: error instanceof Error ? error.message : String(error),
            });
            throw error;
        }
    }
    on(eventType, handler) {
        this.handlers.set(eventType, handler);
    }
    async bind(routingKeyPattern) {
        try {
            const channel = await (0, connection_1.getChannel)();
            await channel.addSetup(async (ch) => {
                await ch.bindQueue(this.queueName, types_1.EXCHANGE_NAME, routingKeyPattern);
                logger.info(`Bound queue '${this.queueName}' to pattern '${routingKeyPattern}'`);
            });
        }
        catch (error) {
            logger.error('Failed to bind queue', {
                queueName: this.queueName,
                routingKeyPattern,
                error: error instanceof Error ? error.message : String(error),
            });
            throw error;
        }
    }
}
exports.EventConsumer = EventConsumer;
async function createEventId() {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
}
__exportStar(require("./types"), exports);
__exportStar(require("./reliability"), exports);
//# sourceMappingURL=index.js.map