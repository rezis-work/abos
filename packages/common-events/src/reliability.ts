import { ConsumeMessage } from 'amqplib';
import { createLogger } from '@common/logger';

const logger = createLogger('events-reliability');

export interface IdempotencyStore {
  isProcessed(eventId: string): Promise<boolean>;
  markProcessed(eventId: string, ttlSeconds?: number): Promise<void>;
}

export class MemoryIdempotencyStore implements IdempotencyStore {
  private processed: Set<string> = new Set();
  private timers: Map<string, NodeJS.Timeout> = new Map();

  async isProcessed(eventId: string): Promise<boolean> {
    return this.processed.has(eventId);
  }

  async markProcessed(eventId: string, ttlSeconds: number = 86400): Promise<void> {
    this.processed.add(eventId);
    
    // Clean up after TTL
    const timer = setTimeout(() => {
      this.processed.delete(eventId);
      this.timers.delete(eventId);
    }, ttlSeconds * 1000);
    
    this.timers.set(eventId, timer);
  }
}

export interface RetryConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
};

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  config: RetryConfig = DEFAULT_RETRY_CONFIG,
  attempt: number = 1
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (attempt >= config.maxRetries) {
      throw error;
    }

    const delay = Math.min(
      config.initialDelayMs * Math.pow(config.backoffMultiplier, attempt - 1),
      config.maxDelayMs
    );

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

export function getRedeliveryCount(message: ConsumeMessage): number {
  const headers = message.properties.headers || {};
  return (headers['x-redelivery-count'] as number) || 0;
}

export function incrementRedeliveryCount(message: ConsumeMessage): number {
  const headers = message.properties.headers || {};
  const count = getRedeliveryCount(message) + 1;
  headers['x-redelivery-count'] = count;
  return count;
}

