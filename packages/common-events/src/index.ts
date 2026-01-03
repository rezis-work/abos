import { Channel, ConsumeMessage } from 'amqplib';
import { getChannel, closeConnection } from './connection';
import { createLogger } from '@common/logger';
import { BaseEvent, RoutingKey, EXCHANGE_NAME } from './types';
import {
  IdempotencyStore,
  MemoryIdempotencyStore,
  RetryConfig,
  DEFAULT_RETRY_CONFIG,
  retryWithBackoff,
  incrementRedeliveryCount,
} from './reliability';

const logger = createLogger('events');

export class EventPublisher {
  async publish(
    routingKey: RoutingKey,
    event: BaseEvent,
    correlationId?: string,
    causationId?: string
  ): Promise<void> {
    try {
      const channel = await getChannel();
      
      // Add correlation IDs if provided
      const eventWithIds: BaseEvent = {
        ...event,
        correlationId: correlationId || event.correlationId,
        causationId: causationId || event.causationId || event.eventId,
      };
      
      const message = Buffer.from(JSON.stringify(eventWithIds));

      await channel.publish(EXCHANGE_NAME, routingKey, message, {
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
    } catch (error) {
      logger.error('Failed to publish event', {
        routingKey,
        eventType: event.eventType,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}

export interface EventHandler<T = unknown> {
  (event: BaseEvent & { payload: T }, message: ConsumeMessage): Promise<void>;
}

export class EventConsumer {
  private queueName: string;
  private dlqName: string;
  private handlers: Map<string, EventHandler> = new Map();
  private idempotencyStore: IdempotencyStore;
  private retryConfig: RetryConfig;

  constructor(
    queueName: string,
    options?: {
      idempotencyStore?: IdempotencyStore;
      retryConfig?: RetryConfig;
    }
  ) {
    this.queueName = queueName;
    this.dlqName = `${queueName}.dlq`;
    this.idempotencyStore = options?.idempotencyStore || new MemoryIdempotencyStore();
    this.retryConfig = options?.retryConfig || DEFAULT_RETRY_CONFIG;
  }

  async start(): Promise<void> {
    try {
      const channel = await getChannel();
      
      await channel.addSetup(async (ch: Channel) => {
        // Assert main queue
        await ch.assertQueue(this.queueName, {
          durable: true,
          arguments: {
            'x-dead-letter-exchange': EXCHANGE_NAME,
            'x-dead-letter-routing-key': this.dlqName,
          },
        });

        // Assert DLQ
        await ch.assertQueue(this.dlqName, {
          durable: true,
        });

        logger.info(`Queue '${this.queueName}' and DLQ '${this.dlqName}' asserted`);

        await ch.consume(
          this.queueName,
          async (message: ConsumeMessage | null) => {
            if (!message) {
              return;
            }

            try {
              const event: BaseEvent = JSON.parse(message.content.toString());

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
                await retryWithBackoff(
                  async () => {
                    await handler(event, message);
                  },
                  this.retryConfig
                );

                // Mark as processed (backup, handlers should do this atomically)
                await this.idempotencyStore.markProcessed(event.eventId);

                ch.ack(message);
              } catch (handlerError: any) {
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
            } catch (error) {
              const redeliveryCount = incrementRedeliveryCount(message);

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
              } else {
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
          },
          {
            noAck: false,
          }
        );

        logger.info(`Started consuming from queue '${this.queueName}'`);
      });
    } catch (error) {
      logger.error('Failed to start consumer', {
        queueName: this.queueName,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  on<T = unknown>(eventType: string, handler: EventHandler<T>): void {
    this.handlers.set(eventType, handler as EventHandler);
  }

  async bind(routingKeyPattern: string): Promise<void> {
    try {
      const channel = await getChannel();
      
      await channel.addSetup(async (ch: Channel) => {
        await ch.bindQueue(this.queueName, EXCHANGE_NAME, routingKeyPattern);
        logger.info(`Bound queue '${this.queueName}' to pattern '${routingKeyPattern}'`);
      });
    } catch (error) {
      logger.error('Failed to bind queue', {
        queueName: this.queueName,
        routingKeyPattern,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}

export async function createEventId(): Promise<string> {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
}

export { closeConnection };
export * from './types';
export * from './reliability';

