import { eq, and, desc } from 'drizzle-orm';
import { db, posts, outboxEvents, type Post } from '../db';
import { createEventId } from '@common/events';
import { getMembershipProjection } from './projection.service';
import { createLogger } from '@common/logger';

const logger = createLogger('post-service');

export interface CreatePostInput {
  buildingId: string;
  userId: string;
  title?: string | null;
  content: string;
  correlationId?: string;
}

/**
 * Create a post with outbox event in a transaction.
 */
export async function createPost(
  input: CreatePostInput
): Promise<Post> {
  // Verify membership via projection
  const projection = await getMembershipProjection(input.userId, input.buildingId);
  if (!projection) {
    throw new Error('User does not have verified membership in this building');
  }

  const eventId = await createEventId();
  const occurredAt = new Date();

  const result = await db.transaction(async (tx) => {
    // Insert post
    const [newPost] = await tx
      .insert(posts)
      .values({
        buildingId: input.buildingId,
        createdByUserId: input.userId,
        title: input.title || null,
        content: input.content,
        status: 'active',
      })
      .returning();

    // Insert outbox event
    await tx.insert(outboxEvents).values({
      eventId,
      eventType: 'post.created',
      version: 'v1',
      payload: {
        postId: newPost.id,
        buildingId: newPost.buildingId,
        createdByUserId: newPost.createdByUserId,
        title: newPost.title,
        createdAt: newPost.createdAt.toISOString(),
        occurredAt: occurredAt.toISOString(),
        correlationId: input.correlationId,
      },
    });

    logger.info('Post created', {
      postId: newPost.id,
      buildingId: input.buildingId,
      userId: input.userId,
    });

    return newPost;
  });

  return result;
}

/**
 * Get posts for a building.
 * Only returns posts with status='active'.
 * Order by createdAt DESC.
 */
export async function getPostsByBuilding(
  buildingId: string,
  options?: {
    limit?: number;
    offset?: number;
  }
): Promise<Post[]> {
  const limit = options?.limit || 50;
  const offset = options?.offset || 0;

  return await db
    .select()
    .from(posts)
    .where(
      and(
        eq(posts.buildingId, buildingId),
        eq(posts.status, 'active')
      )
    )
    .orderBy(desc(posts.createdAt))
    .limit(limit)
    .offset(offset);
}

/**
 * Get post by ID.
 */
export async function getPostById(postId: string): Promise<Post | null> {
  const [post] = await db
    .select()
    .from(posts)
    .where(eq(posts.id, postId))
    .limit(1);

  return post || null;
}

