import { BaseEvent } from '@common/events';
import { ConsumeMessage } from 'amqplib';
import { createLogger } from '@common/logger';
import { residentVerifiedV1Schema, type ResidentVerifiedV1Payload } from './schemas';
import { createNotificationWithIdempotency } from '../services/notification.service';

const logger = createLogger('resident-verified-handler');

/**
 * Handler for resident.verified.v1 events.
 * Creates a notification when a resident is verified for a building/unit.
 * Uses atomic idempotency: inserts processed_events first in same transaction.
 */
export async function handleResidentVerified(
  event: BaseEvent & { payload: ResidentVerifiedV1Payload },
  _message: ConsumeMessage
): Promise<void> {
  try {
    // Validate event payload
    const validationResult = residentVerifiedV1Schema.safeParse(event.payload);
    if (!validationResult.success) {
      logger.error('Invalid resident.verified.v1 event payload', {
        eventId: event.eventId,
        errors: validationResult.error.errors,
      });
      throw new Error('Invalid event payload');
    }

    const payload = validationResult.data;

    logger.info('Processing resident.verified event', {
      eventId: event.eventId,
      userId: payload.userId,
      buildingId: payload.buildingId,
      unitId: payload.unitId,
      correlationId: event.correlationId,
    });

    try {
      // Create resident verified notification with atomic idempotency
      // This will insert processed_events first, then notification
      // If event already processed, throws 'EVENT_ALREADY_PROCESSED'
      // Note: Building name and unit number would need to be fetched from Buildings service
      // For MVP, we'll use IDs in the notification
      await createNotificationWithIdempotency(
        {
          userId: payload.userId,
          type: 'resident_verified',
          title: 'You\'re verified!',
          body: `You're verified for Building ${payload.buildingId.substring(0, 8)} / Unit ${payload.unitId.substring(0, 8)}`,
          data: {
            eventId: event.eventId,
            buildingId: payload.buildingId,
            unitId: payload.unitId,
            roleInBuilding: payload.roleInBuilding,
            occurredAt: payload.occurredAt,
            correlationId: event.correlationId,
          },
        },
        event.eventId,
        {
          channel: 'in_app',
          status: 'delivered',
        }
      );

      logger.info('Resident verified notification created', {
        eventId: event.eventId,
        userId: payload.userId,
        buildingId: payload.buildingId,
      });
    } catch (error: any) {
      // If event already processed, log and return (don't throw)
      if (error?.message === 'EVENT_ALREADY_PROCESSED') {
        logger.info('Event already processed, skipping notification creation', {
          eventId: event.eventId,
          userId: payload.userId,
          buildingId: payload.buildingId,
        });
        return; // ACK the message
      }
      // Re-throw other errors to trigger retry
      throw error;
    }
  } catch (error) {
    logger.error('Error handling resident.verified.v1 event', {
      eventId: event.eventId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error; // Re-throw to trigger retry mechanism
  }
}

