import { BaseEvent } from '@common/events';
import { ConsumeMessage } from 'amqplib';
import { createLogger } from '@common/logger';
import { ticketStatusChangedV1Schema, type TicketStatusChangedV1Payload } from './schemas';
import { createNotificationWithIdempotency } from '../services/notification.service';

const logger = createLogger('ticket-status-changed-handler');

/**
 * Handler for ticket.status_changed.v1 events.
 * Creates a notification for the ticket creator when status changes.
 * Uses atomic idempotency: inserts processed_events first in same transaction.
 */
export async function handleTicketStatusChanged(
  event: BaseEvent & { payload: TicketStatusChangedV1Payload },
  _message: ConsumeMessage
): Promise<void> {
  try {
    // Validate event payload
    const validationResult = ticketStatusChangedV1Schema.safeParse(event.payload);
    if (!validationResult.success) {
      logger.error('Invalid ticket.status_changed.v1 event payload', {
        eventId: event.eventId,
        errors: validationResult.error.errors,
      });
      throw new Error('Invalid event payload');
    }

    const payload = validationResult.data;

    logger.info('Processing ticket.status_changed event', {
      eventId: event.eventId,
      ticketId: payload.ticketId,
      createdByUserId: payload.createdByUserId,
      oldStatus: payload.oldStatus,
      newStatus: payload.newStatus,
      correlationId: event.correlationId,
    });

    try {
      // Create notification for ticket creator
      await createNotificationWithIdempotency(
        {
          userId: payload.createdByUserId,
          type: 'ticket_status_changed',
          title: 'Ticket status updated',
          body: `Ticket is now ${payload.newStatus}`,
          data: {
            eventId: event.eventId,
            ticketId: payload.ticketId,
            buildingId: payload.buildingId,
            oldStatus: payload.oldStatus,
            newStatus: payload.newStatus,
            changedByUserId: payload.changedByUserId,
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

      logger.info('Ticket status changed notification sent', {
        eventId: event.eventId,
        ticketId: payload.ticketId,
        userId: payload.createdByUserId,
        newStatus: payload.newStatus,
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
    logger.error('Error handling ticket.status_changed.v1 event', {
      eventId: event.eventId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error; // Re-throw to trigger retry mechanism
  }
}

