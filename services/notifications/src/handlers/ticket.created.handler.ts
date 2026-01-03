import { BaseEvent } from '@common/events';
import { ConsumeMessage } from 'amqplib';
import { createLogger } from '@common/logger';
import { ticketCreatedV1Schema, type TicketCreatedV1Payload } from './schemas';
import { createNotificationWithIdempotency } from '../services/notification.service';

const logger = createLogger('ticket-created-handler');

/**
 * Handler for ticket.created.v1 events.
 * Creates a notification for the ticket creator.
 * Uses atomic idempotency: inserts processed_events first in same transaction.
 */
export async function handleTicketCreated(
  event: BaseEvent & { payload: TicketCreatedV1Payload },
  _message: ConsumeMessage
): Promise<void> {
  try {
    // Validate event payload
    const validationResult = ticketCreatedV1Schema.safeParse(event.payload);
    if (!validationResult.success) {
      logger.error('Invalid ticket.created.v1 event payload', {
        eventId: event.eventId,
        errors: validationResult.error.errors,
      });
      throw new Error('Invalid event payload');
    }

    const payload = validationResult.data;

    logger.info('Processing ticket.created event', {
      eventId: event.eventId,
      ticketId: payload.ticketId,
      createdByUserId: payload.createdByUserId,
      correlationId: event.correlationId,
    });

    try {
      // Create notification for ticket creator
      await createNotificationWithIdempotency(
        {
          userId: payload.createdByUserId,
          type: 'ticket_created',
          title: 'Ticket created',
          body: `Your ticket "${payload.title}" was created. Status: ${payload.status}.`,
          data: {
            eventId: event.eventId,
            ticketId: payload.ticketId,
            buildingId: payload.buildingId,
            unitId: payload.unitId,
            title: payload.title,
            category: payload.category,
            priority: payload.priority,
            status: payload.status,
            createdAt: payload.createdAt,
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

      logger.info('Ticket created notification sent', {
        eventId: event.eventId,
        ticketId: payload.ticketId,
        userId: payload.createdByUserId,
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
    logger.error('Error handling ticket.created.v1 event', {
      eventId: event.eventId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error; // Re-throw to trigger retry mechanism
  }
}

