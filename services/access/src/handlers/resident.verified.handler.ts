import { BaseEvent } from '@common/events';
import { ConsumeMessage } from 'amqplib';
import { createLogger } from '@common/logger';
import { residentVerifiedV1Schema, type ResidentVerifiedV1Payload } from './schemas';
import { upsertMembershipProjection } from '../services/projection.service';

const logger = createLogger('resident-verified-handler');

/**
 * Handler for resident.verified.v1 events.
 * Updates the local membership projection.
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
      roleInBuilding: payload.roleInBuilding,
      correlationId: event.correlationId,
    });

    try {
      // Upsert membership projection with atomic idempotency
      // This will insert processed_events first, then upsert projection
      // If event already processed, throws 'EVENT_ALREADY_PROCESSED'
      // Note: Access service only stores userId, buildingId, role, verifiedAt (not unitId)
      await upsertMembershipProjection(
        payload.userId,
        payload.buildingId,
        payload.roleInBuilding,
        new Date(payload.occurredAt),
        event.eventId
      );

      logger.info('Membership projection updated', {
        eventId: event.eventId,
        userId: payload.userId,
        buildingId: payload.buildingId,
      });
    } catch (error: any) {
      // If event already processed, log and return (don't throw)
      if (error?.message === 'EVENT_ALREADY_PROCESSED') {
        logger.info('Event already processed, skipping projection update', {
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

