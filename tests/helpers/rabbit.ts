/**
 * RabbitMQ helper for integration tests
 * Publishes events to the same exchange that services consume from
 */

import amqp from 'amqplib';
import { BaseEvent, EXCHANGE_NAME } from '@common/events';
import { randomUUID } from 'crypto';

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://test:test@localhost:5673';

let connection: amqp.Connection | null = null;
let channel: amqp.Channel | null = null;

/**
 * Get or create RabbitMQ connection and channel
 */
async function getChannel(): Promise<amqp.Channel> {
  if (channel && channel.connection.ready) {
    return channel;
  }

  if (connection) {
    await connection.close();
  }

  connection = await amqp.connect(RABBITMQ_URL);
  channel = await connection.createChannel();

  // Assert exchange exists
  await channel.assertExchange(EXCHANGE_NAME, 'topic', {
    durable: true,
  });

  return channel;
}

/**
 * Publish an event to RabbitMQ
 */
export async function publishEvent(
  routingKey: string,
  eventType: string,
  payload: Record<string, unknown>,
  options?: {
    eventId?: string;
    correlationId?: string;
    causationId?: string;
  }
): Promise<void> {
  const channel = await getChannel();

  const event: BaseEvent = {
    eventId: options?.eventId || randomUUID(),
    version: 'v1',
    eventType,
    timestamp: new Date().toISOString(),
    payload,
    correlationId: options?.correlationId,
    causationId: options?.causationId,
  };

  const message = Buffer.from(JSON.stringify(event));

  await channel.publish(EXCHANGE_NAME, routingKey, message, {
    persistent: true,
    messageId: event.eventId,
    timestamp: Date.now(),
    type: eventType,
    correlationId: event.correlationId,
    headers: {
      'x-correlation-id': event.correlationId,
      'x-causation-id': event.causationId,
    },
  });
}

/**
 * Publish resident.verified.v1 event
 */
export async function publishResidentVerified(
  userId: string,
  buildingId: string,
  unitId: string,
  roleInBuilding: 'resident' | 'admin',
  options?: {
    eventId?: string;
    correlationId?: string;
  }
): Promise<void> {
  await publishEvent(
    'resident.verified.v1',
    'resident.verified',
    {
      userId,
      buildingId,
      unitId,
      roleInBuilding,
      occurredAt: new Date().toISOString(),
    },
    options
  );
}

/**
 * Close RabbitMQ connection (cleanup)
 */
export async function closeRabbitMQ(): Promise<void> {
  if (channel) {
    await channel.close();
    channel = null;
  }
  if (connection) {
    await connection.close();
    connection = null;
  }
}

