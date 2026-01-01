import { Channel, ConsumeMessage } from 'amqplib';
import { getChannel, closeConnection } from './connection';
import { createLogger } from '@common/logger';
import { BaseEvent, RoutingKey, EXCHANGE_NAME } from './types';

const logger = createLogger('events');

export class EventPublisher {
  async publish(routingKey: RoutingKey, event: BaseEvent): Promise<void> {
    try {
      const channel = await getChannel();
      const message = Buffer.from(JSON.stringify(event));

      await channel.publish(EXCHANGE_NAME, routingKey, message, {
        persistent: true,
        messageId: event.eventId,
        timestamp: Date.now(),
        type: event.eventType,
      });

      logger.debug('Event published', {
        routingKey,
        eventType: event.eventType,
        eventId: event.eventId,
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
  private handlers: Map<string, EventHandler> = new Map();

  constructor(queueName: string) {
    this.queueName = queueName;
  }

  async start(): Promise<void> {
    try {
      const channel = await getChannel();
      
      await channel.addSetup(async (ch: Channel) => {
        await ch.assertQueue(this.queueName, {
          durable: true,
        });

        logger.info(`Queue '${this.queueName}' asserted`);

        await ch.consume(
          this.queueName,
          async (message: ConsumeMessage | null) => {
            if (!message) {
              return;
            }

            try {
              const event: BaseEvent = JSON.parse(message.content.toString());
              const handler = this.handlers.get(event.eventType);

              if (handler) {
                await handler(event, message);
                ch.ack(message);
              } else {
                logger.warn('No handler found for event type', {
                  eventType: event.eventType,
                  queueName: this.queueName,
                });
                ch.nack(message, false, true); // Requeue for retry
              }
            } catch (error) {
              logger.error('Error processing event', {
                error: error instanceof Error ? error.message : String(error),
                queueName: this.queueName,
              });
              ch.nack(message, false, true); // Requeue for retry
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

