import { eq } from 'drizzle-orm';
import { db, processedEvents } from '../db';
import { IdempotencyStore } from '@common/events';
import { createLogger } from '@common/logger';

const logger = createLogger('idempotency-store');

/**
 * Database-backed idempotency store for event processing.
 * Uses the processed_events table to track which events have been processed.
 */
export class DatabaseIdempotencyStore implements IdempotencyStore {
  async isProcessed(eventId: string): Promise<boolean> {
    try {
      const [processed] = await db
        .select()
        .from(processedEvents)
        .where(eq(processedEvents.eventId, eventId))
        .limit(1);

      return !!processed;
    } catch (error) {
      logger.error('Error checking if event is processed', {
        eventId,
        error: error instanceof Error ? error.message : String(error),
      });
      // On error, assume not processed to allow retry
      return false;
    }
  }

  async markProcessed(eventId: string, _ttlSeconds?: number): Promise<void> {
    try {
      // Check if already exists (race condition protection)
      const exists = await this.isProcessed(eventId);
      if (exists) {
        logger.debug('Event already marked as processed', { eventId });
        return;
      }

      await db.insert(processedEvents).values({
        eventId,
        processedAt: new Date(),
      });

      logger.debug('Event marked as processed', { eventId });
    } catch (error) {
      logger.error('Error marking event as processed', {
        eventId,
        error: error instanceof Error ? error.message : String(error),
      });
      // Re-throw to allow consumer to handle
      throw error;
    }
  }
}

