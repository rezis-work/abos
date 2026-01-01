import 'express-async-errors';
import express from 'express';
import { getEnv } from '@common/env';
import { createLogger } from '@common/logger';
import {
  Express,
  errorHandler,
  requestLogger,
} from '@common/http';
import { healthRoute } from './routes/health';

const env = getEnv();
const logger = createLogger(env.SERVICE_NAME || 'template-service');
const app: Express = express();

// Middleware
app.use(express.json());
app.use(requestLogger(logger));

// Routes
app.get('/health', healthRoute);

// Error handling (must be last)
app.use(errorHandler);

// Graceful shutdown
const server = app.listen(env.PORT || 3000, () => {
  logger.info('Service started', {
    port: env.PORT || 3000,
    nodeEnv: env.NODE_ENV,
  });
});

const shutdown = (signal: string) => {
  logger.info(`Received ${signal}, shutting down gracefully`);
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

