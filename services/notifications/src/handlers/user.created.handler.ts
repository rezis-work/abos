import { BaseEvent } from '@common/events';
import { ConsumeMessage } from 'amqplib';
import { createLogger } from '@common/logger';
import { userCreatedV1Schema, type UserCreatedV1Payload } from './schemas';
import { createNotificationWithIdempotency } from '../services/notification.service';

const logger = createLogger('user-created-handler');

/**
 * Handler for user.created.v1 events.
 * Creates a welcome notification for new users.
 * Uses atomic idempotency: inserts processed_events first in same transaction.
 */
export async function handleUserCreated(
  event: BaseEvent & { payload: UserCreatedV1Payload },
  _message: ConsumeMessage
): Promise<void> {
  try {
    // Validate event payload
    const validationResult = userCreatedV1Schema.safeParse(event.payload);
    if (!validationResult.success) {
      logger.error('Invalid user.created.v1 event payload', {
        eventId: event.eventId,
        errors: validationResult.error.errors,
      });
      throw new Error('Invalid event payload');
    }

    const payload = validationResult.data;

    logger.info('Processing user.created event', {
      eventId: event.eventId,
      userId: payload.userId,
      correlationId: event.correlationId,
    });

    try {
      // Create welcome notification with atomic idempotency
      // This will insert processed_events first, then notification
      // If event already processed, throws 'EVENT_ALREADY_PROCESSED'
      await createNotificationWithIdempotency(
        {
          userId: payload.userId,
          type: 'welcome',
          title: 'Welcome!',
          body: 'Welcome to the platform! We\'re excited to have you here.',
          data: {
            eventId: event.eventId,
            email: payload.email,
            role: payload.role,
            correlationId: event.correlationId,
          },
        },
        event.eventId,
        {
          channel: 'in_app',
          status: 'delivered',
        }
      );

      logger.info('Welcome notification created', {
        eventId: event.eventId,
        userId: payload.userId,
      });
    } catch (error: any) {
      // If event already processed, log and return (don't throw)
      if (error?.message === 'EVENT_ALREADY_PROCESSED') {
        logger.info('Event already processed, skipping notification creation', {
          eventId: event.eventId,
          userId: payload.userId,
        });
        return; // ACK the message
      }
      // Re-throw other errors to trigger retry
      throw error;
    }
  } catch (error) {
    logger.error('Error handling user.created.v1 event', {
      eventId: event.eventId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error; // Re-throw to trigger retry mechanism
  }
}

