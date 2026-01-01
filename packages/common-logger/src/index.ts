import winston from 'winston';
import { getEnv } from '@common/env';

export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

export interface LoggerContext {
  service?: string;
  requestId?: string;
  userId?: string;
  [key: string]: unknown;
}

class Logger {
  private logger: winston.Logger;

  constructor(serviceName?: string) {
    const env = getEnv();
    const isProduction = env.NODE_ENV === 'production';
    const logLevel = (env.LOG_LEVEL || 'info') as LogLevel;

    const format = winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      isProduction
        ? winston.format.json()
        : winston.format.combine(
            winston.format.colorize(),
            winston.format.printf(({ timestamp, level, message, ...meta }) => {
              const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
              return `${timestamp} [${level}]: ${message} ${metaStr}`;
            })
          )
    );

    this.logger = winston.createLogger({
      level: logLevel,
      format,
      defaultMeta: {
        service: serviceName || env.SERVICE_NAME || 'unknown',
      },
      transports: [
        new winston.transports.Console({
          stderrLevels: ['error'],
        }),
      ],
    });
  }

  error(message: string, context?: LoggerContext): void {
    this.logger.error(message, context);
  }

  warn(message: string, context?: LoggerContext): void {
    this.logger.warn(message, context);
  }

  info(message: string, context?: LoggerContext): void {
    this.logger.info(message, context);
  }

  debug(message: string, context?: LoggerContext): void {
    this.logger.debug(message, context);
  }

  child(context: LoggerContext): Logger {
    const childLogger = new Logger();
    childLogger.logger = this.logger.child(context);
    return childLogger;
  }
}

let defaultLogger: Logger | null = null;

export function createLogger(serviceName?: string): Logger {
  return new Logger(serviceName);
}

export function getLogger(): Logger {
  if (!defaultLogger) {
    defaultLogger = createLogger();
  }
  return defaultLogger;
}

export { Logger };

