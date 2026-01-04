import { eq, and, asc } from 'drizzle-orm';
import { db, comments, posts, outboxEvents, type Comment } from '../db';
import { createEventId } from '@common/events';
import { getMembershipProjection } from './projection.service';
import { createLogger } from '@common/logger';

const logger = createLogger('comment-service');

export interface CreateCommentInput {
  postId: string;
  userId: string;
  content: string;
  correlationId?: string;
}

/**
 * Create a comment with outbox event in a transaction.
 * Includes postAuthorUserId in event payload for notifications.
 */
export async function createComment(
  input: CreateCommentInput
): Promise<Comment> {
  const eventId = await createEventId();
  const occurredAt = new Date();

  const result = await db.transaction(async (tx) => {
    // Load post to get buildingId and createdByUserId
    const [post] = await tx
      .select()
      .from(posts)
      .where(eq(posts.id, input.postId))
      .limit(1);

    if (!post) {
      throw new Error('Post not found');
    }

    // Verify post is active
    if (post.status !== 'active') {
      throw new Error('Post is not active');
    }

    // Verify caller is verified member of post's building
    const projection = await getMembershipProjection(input.userId, post.buildingId);
    if (!projection) {
      throw new Error('User does not have verified membership in this building');
    }

    // Insert comment
    const [newComment] = await tx
      .insert(comments)
      .values({
        postId: input.postId,
        buildingId: post.buildingId,
        createdByUserId: input.userId,
        content: input.content,
        status: 'active',
      })
      .returning();

    // Insert outbox event with postAuthorUserId for notifications
    await tx.insert(outboxEvents).values({
      eventId,
      eventType: 'comment.created',
      version: 'v1',
      payload: {
        commentId: newComment.id,
        postId: input.postId,
        buildingId: post.buildingId,
        createdByUserId: input.userId,
        postAuthorUserId: post.createdByUserId, // Include for notifications
        createdAt: newComment.createdAt.toISOString(),
        occurredAt: occurredAt.toISOString(),
        correlationId: input.correlationId,
      },
    });

    logger.info('Comment created', {
      commentId: newComment.id,
      postId: input.postId,
      userId: input.userId,
    });

    return newComment;
  });

  return result;
}

/**
 * Get comments for a post.
 * Only returns comments with status='active'.
 * Order by createdAt ASC.
 */
export async function getCommentsByPost(
  postId: string,
  options?: {
    limit?: number;
    offset?: number;
  }
): Promise<Comment[]> {
  const limit = options?.limit || 50;
  const offset = options?.offset || 0;

  return await db
    .select()
    .from(comments)
    .where(
      and(
        eq(comments.postId, postId),
        eq(comments.status, 'active')
      )
    )
    .orderBy(asc(comments.createdAt))
    .limit(limit)
    .offset(offset);
}

