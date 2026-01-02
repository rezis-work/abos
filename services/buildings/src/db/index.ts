import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { getEnv } from '@common/env';
import { createLogger } from '@common/logger';
import * as schema from './schema';

const logger = createLogger('buildings-db');

const env = getEnv();
const databaseUrl =
  env.DATABASE_URL ||
  `postgresql://${env.POSTGRES_USER}:${env.POSTGRES_PASSWORD}@${env.POSTGRES_HOST}:${env.POSTGRES_PORT}/${env.POSTGRES_DB || 'building_db'}`;

// Create postgres connection with connection pooling
const queryClient = postgres(databaseUrl, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
});

// Create Drizzle instance
export const db = drizzle(queryClient, { schema });

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('Closing database connection');
  queryClient.end();
});

process.on('SIGINT', () => {
  logger.info('Closing database connection');
  queryClient.end();
});

export * from './schema';

