import { eq } from 'drizzle-orm';
import { db, outboxEvents } from '../db';
import { EventPublisher } from '@common/events';
import { createLogger } from '@common/logger';
import { BaseEvent } from '@common/events';

const logger = createLogger('outbox-service');
const publisher = new EventPublisher();

const OUTBOX_POLL_INTERVAL_MS = 5000; // 5 seconds

export async function processOutbox(): Promise<void> {
  try {
    // Find unpublished events
    const unpublishedEvents = await db
      .select()
      .from(outboxEvents)
      .where(eq(outboxEvents.published, false))
      .limit(10); // Process in batches

    if (unpublishedEvents.length === 0) {
      return;
    }

    logger.debug(`Processing ${unpublishedEvents.length} outbox events`);

    for (const event of unpublishedEvents) {
      try {
        // Extract correlation ID from payload if present
        const payload = event.payload as Record<string, unknown>;
        const correlationId = payload.correlationId as string | undefined;
        const causationId = event.eventId; // Current event ID becomes causation ID

        // Create event payload (remove correlationId and eventId from payload as they're now in event metadata)
        const { correlationId: _, eventId: __, ...cleanPayload } = payload;
        const baseEvent: BaseEvent = {
          eventId: event.eventId,
          version: event.version,
          eventType: event.eventType,
          timestamp: event.createdAt.toISOString(),
          payload: cleanPayload,
          correlationId,
          causationId,
        };

        // Publish to RabbitMQ with correlation IDs
        // Map event type to routing key (e.g., 'ticket.created' -> 'ticket.created.v1')
        // Use versioned routing key if version is specified
        const routingKey = event.version
          ? (`${event.eventType}.${event.version}` as any)
          : (event.eventType as any);
        await publisher.publish(routingKey, baseEvent, correlationId, causationId);

        // Mark as published
        await db
          .update(outboxEvents)
          .set({
            published: true,
            publishedAt: new Date(),
          })
          .where(eq(outboxEvents.id, event.id));

        logger.info('Published outbox event', {
          eventId: event.eventId,
          eventType: event.eventType,
        });
      } catch (error) {
        logger.error('Failed to publish outbox event', {
          eventId: event.eventId,
          eventType: event.eventType,
          error: error instanceof Error ? error.message : String(error),
        });
        // Continue processing other events
      }
    }
  } catch (error) {
    logger.error('Error processing outbox', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export function startOutboxWorker(): void {
  logger.info('Starting outbox worker', {
    interval: `${OUTBOX_POLL_INTERVAL_MS}ms`,
  });

  // Process immediately on start
  processOutbox().catch((error) => {
    logger.error('Error in initial outbox processing', {
      error: error instanceof Error ? error.message : String(error),
    });
  });

  // Then process on interval
  setInterval(() => {
    processOutbox().catch((error) => {
      logger.error('Error in outbox processing', {
        error: error instanceof Error ? error.message : String(error),
      });
    });
  }, OUTBOX_POLL_INTERVAL_MS);
}

