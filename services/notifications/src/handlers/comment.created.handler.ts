import { BaseEvent } from '@common/events';
import { ConsumeMessage } from 'amqplib';
import { createLogger } from '@common/logger';
import {
  commentCreatedV1Schema,
  type CommentCreatedV1Payload,
} from './schemas';
import { createNotificationWithIdempotency } from '../services/notification.service';

const logger = createLogger('comment-created-handler');

/**
 * Handler for comment.created.v1 events.
 * Creates a notification for the post author (if different from commenter).
 */
export async function handleCommentCreated(
  event: BaseEvent & { payload: CommentCreatedV1Payload },
  _message: ConsumeMessage
): Promise<void> {
  try {
    // Validate event payload
    const validationResult = commentCreatedV1Schema.safeParse(event.payload);
    if (!validationResult.success) {
      logger.error('Invalid comment.created.v1 event payload', {
        eventId: event.eventId,
        errors: validationResult.error.errors,
      });
      throw new Error('Invalid event payload');
    }

    const payload = validationResult.data;

    logger.info('Processing comment.created event', {
      eventId: event.eventId,
      commentId: payload.commentId,
      postId: payload.postId,
      createdByUserId: payload.createdByUserId,
      postAuthorUserId: payload.postAuthorUserId,
      correlationId: event.correlationId,
    });

    // Only notify if commenter is different from post author
    if (payload.createdByUserId === payload.postAuthorUserId) {
      logger.debug('Commenter is post author, skipping notification', {
        eventId: event.eventId,
        userId: payload.postAuthorUserId,
      });
      return; // ACK the message
    }

    try {
      await createNotificationWithIdempotency(
        {
          userId: payload.postAuthorUserId,
          type: 'post_commented',
          title: 'New comment',
          body: 'Someone commented on your post',
          data: {
            eventId: event.eventId,
            commentId: payload.commentId,
            postId: payload.postId,
            buildingId: payload.buildingId,
            createdByUserId: payload.createdByUserId,
            createdAt: payload.createdAt,
            correlationId: event.correlationId,
          },
        },
        event.eventId,
        {
          channel: 'in_app',
          status: 'delivered',
        }
      );

      logger.info('Notification created for comment.created event', {
        eventId: event.eventId,
        commentId: payload.commentId,
        postId: payload.postId,
        notifiedUserId: payload.postAuthorUserId,
      });
    } catch (error: any) {
      // If error is due to idempotency (event already processed), log and return
      if (error?.message?.includes('already processed') || error?.code === '23505') {
        logger.info('Event already processed, skipping notification creation', {
          eventId: event.eventId,
          commentId: payload.commentId,
        });
        return; // ACK the message
      }
      // Re-throw other errors to trigger retry
      throw error;
    }
  } catch (error) {
    logger.error('Error handling comment.created.v1 event', {
      eventId: event.eventId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error; // Re-throw to trigger retry mechanism
  }
}

