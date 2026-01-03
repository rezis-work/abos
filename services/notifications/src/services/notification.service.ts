import { eq, and, desc } from 'drizzle-orm';
import { db, notifications, notificationDeliveries, processedEvents, type Notification, type NotificationDelivery } from '../db';
import { createLogger } from '@common/logger';

const logger = createLogger('notification-service');

export interface CreateNotificationInput {
  userId: string;
  type: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

export interface CreateNotificationDeliveryOptions {
  channel?: string;
  status?: 'pending' | 'sent' | 'delivered' | 'failed';
}

/**
 * Create a notification and its delivery record in a transaction.
 * Also marks the event as processed atomically (for idempotency).
 */
export async function createNotificationWithIdempotency(
  input: CreateNotificationInput,
  eventId: string,
  deliveryOptions?: CreateNotificationDeliveryOptions
): Promise<{ notification: Notification; delivery: NotificationDelivery }> {
  const result = await db.transaction(async (tx) => {
    // Try to insert processed_events first (atomic idempotency check)
    // If this fails (unique violation), the transaction will rollback
    try {
      await tx.insert(processedEvents).values({
        eventId,
        processedAt: new Date(),
      });
    } catch (error: any) {
      // If unique constraint violation, event already processed
      if (error?.code === '23505') { // PostgreSQL unique_violation
        throw new Error('EVENT_ALREADY_PROCESSED');
      }
      // Re-throw other errors
      throw error;
    }

    // Create notification
    const [notification] = await tx
      .insert(notifications)
      .values({
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body,
        data: input.data || null,
      })
      .returning();

    // Create delivery record (default to in_app, delivered)
    const [delivery] = await tx
      .insert(notificationDeliveries)
      .values({
        notificationId: notification.id,
        channel: deliveryOptions?.channel || 'in_app',
        status: deliveryOptions?.status || 'delivered',
        error: null,
      })
      .returning();

    return { notification, delivery };
  });

  return result;
}

/**
 * Create a notification and its delivery record in a transaction.
 * Use this when idempotency is handled separately (e.g., by consumer).
 */
export async function createNotification(
  input: CreateNotificationInput,
  deliveryOptions?: CreateNotificationDeliveryOptions
): Promise<{ notification: Notification; delivery: NotificationDelivery }> {
  const result = await db.transaction(async (tx) => {
    // Create notification
    const [notification] = await tx
      .insert(notifications)
      .values({
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body,
        data: input.data || null,
      })
      .returning();

    // Create delivery record (default to in_app, delivered)
    const [delivery] = await tx
      .insert(notificationDeliveries)
      .values({
        notificationId: notification.id,
        channel: deliveryOptions?.channel || 'in_app',
        status: deliveryOptions?.status || 'delivered',
        error: null,
      })
      .returning();

    return { notification, delivery };
  });

  return result;
}

/**
 * Get notifications for a user.
 */
export async function getUserNotifications(
  userId: string,
  limit: number = 50,
  offset: number = 0
): Promise<Notification[]> {
  logger.info('Querying notifications', { userId, limit, offset, userIdType: typeof userId });
  
  const result = await db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(limit)
    .offset(offset);
  
  // Debug: Also query all notifications to see what's in DB
  const allNotifications = await db
    .select({ userId: notifications.userId, type: notifications.type, createdAt: notifications.createdAt })
    .from(notifications)
    .orderBy(desc(notifications.createdAt))
    .limit(10);
  
  logger.info('Notifications query result', { 
    userId, 
    resultCount: result.length,
    resultUserIds: result.map(n => n.userId),
    allNotificationsInDb: allNotifications.map(n => ({ userId: n.userId, type: n.type }))
  });
  
  return result;
}

/**
 * Get a notification by ID.
 */
export async function getNotificationById(
  notificationId: string,
  userId?: string
): Promise<Notification | null> {
  const conditions = userId
    ? and(eq(notifications.id, notificationId), eq(notifications.userId, userId))
    : eq(notifications.id, notificationId);

  const [notification] = await db
    .select()
    .from(notifications)
    .where(conditions)
    .limit(1);

  return notification || null;
}

/**
 * Mark a notification as read.
 */
export async function markNotificationAsRead(
  notificationId: string,
  userId: string
): Promise<Notification | null> {
  const [notification] = await db
    .update(notifications)
    .set({
      readAt: new Date(),
    })
    .where(
      and(
        eq(notifications.id, notificationId),
        eq(notifications.userId, userId)
      )
    )
    .returning();

  return notification || null;
}

