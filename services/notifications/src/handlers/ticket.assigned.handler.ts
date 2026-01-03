import { BaseEvent } from '@common/events';
import { ConsumeMessage } from 'amqplib';
import { createLogger } from '@common/logger';
import { ticketAssignedV1Schema, type TicketAssignedV1Payload } from './schemas';
import { createNotificationWithIdempotency } from '../services/notification.service';

const logger = createLogger('ticket-assigned-handler');

/**
 * Handler for ticket.assigned.v1 events.
 * Creates a notification for the assigned user (if assignedToUserId is not null).
 * Uses atomic idempotency: inserts processed_events first in same transaction.
 */
export async function handleTicketAssigned(
  event: BaseEvent & { payload: TicketAssignedV1Payload },
  _message: ConsumeMessage
): Promise<void> {
  try {
    // Validate event payload
    const validationResult = ticketAssignedV1Schema.safeParse(event.payload);
    if (!validationResult.success) {
      logger.error('Invalid ticket.assigned.v1 event payload', {
        eventId: event.eventId,
        errors: validationResult.error.errors,
      });
      throw new Error('Invalid event payload');
    }

    const payload = validationResult.data;

    logger.info('Processing ticket.assigned event', {
      eventId: event.eventId,
      ticketId: payload.ticketId,
      assignedToUserId: payload.assignedToUserId,
      correlationId: event.correlationId,
    });

    // If no user assigned (unassign), skip notification
    if (!payload.assignedToUserId) {
      logger.info('Ticket unassigned, skipping notification', {
        eventId: event.eventId,
        ticketId: payload.ticketId,
      });
      return; // ACK the message
    }

    try {
      // Create notification for assigned user
      await createNotificationWithIdempotency(
        {
          userId: payload.assignedToUserId,
          type: 'ticket_assigned',
          title: 'New ticket assigned',
          body: `You were assigned ticket "${payload.title}" (Building ${payload.buildingId.substring(0, 8)})`,
          data: {
            eventId: event.eventId,
            ticketId: payload.ticketId,
            buildingId: payload.buildingId,
            title: payload.title,
            assignedByUserId: payload.assignedByUserId,
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

      logger.info('Ticket assigned notification sent', {
        eventId: event.eventId,
        ticketId: payload.ticketId,
        assignedToUserId: payload.assignedToUserId,
      });
    } catch (error: any) {
      // If event already processed, log and return (don't throw)
      if (error?.message === 'EVENT_ALREADY_PROCESSED') {
        logger.info('Event already processed, skipping notification creation', {
          eventId: event.eventId,
          ticketId: payload.ticketId,
        });
        return; // ACK the message
      }
      // Re-throw other errors to trigger retry
      throw error;
    }
  } catch (error) {
    logger.error('Error handling ticket.assigned.v1 event', {
      eventId: event.eventId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error; // Re-throw to trigger retry mechanism
  }
}

