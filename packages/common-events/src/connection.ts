import * as amqp from 'amqp-connection-manager';
import { Channel } from 'amqplib';
import { getEnv } from '@common/env';
import { createLogger } from '@common/logger';
import { EXCHANGE_NAME, EXCHANGE_TYPE } from './types';

const logger = createLogger('events');

let connection: amqp.AmqpConnectionManager | null = null;
let channelWrapper: amqp.ChannelWrapper | null = null;

export async function getConnection(): Promise<amqp.AmqpConnectionManager> {
  if (connection) {
    return connection;
  }

  const env = getEnv();
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

export async function getChannel(): Promise<amqp.ChannelWrapper> {
  if (channelWrapper) {
    return channelWrapper;
  }

  const conn = await getConnection();
  channelWrapper = conn.createChannel({
    setup: async (channel: Channel) => {
      await channel.assertExchange(EXCHANGE_NAME, EXCHANGE_TYPE, {
        durable: true,
      });
      logger.info(`Exchange '${EXCHANGE_NAME}' asserted`);
    },
  });

  return channelWrapper;
}

export async function closeConnection(): Promise<void> {
  if (channelWrapper) {
    await channelWrapper.close();
    channelWrapper = null;
  }
  if (connection) {
    await connection.close();
    connection = null;
  }
}

