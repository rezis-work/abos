import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  text,
  jsonb,
  pgEnum,
  index,
  unique,
} from 'drizzle-orm/pg-core';

export const notificationDeliveryStatusEnum = pgEnum('delivery_status', [
  'pending',
  'sent',
  'delivered',
  'failed',
]);

export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').notNull(), // References IAM users (no FK constraint)
    type: varchar('type', { length: 100 }).notNull(), // e.g., 'welcome', 'resident_verified'
    title: varchar('title', { length: 255 }).notNull(),
    body: text('body').notNull(),
    data: jsonb('data'), // Additional metadata
    readAt: timestamp('read_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index('notifications_user_id_idx').on(table.userId),
    userReadIdx: index('notifications_user_read_idx').on(table.userId, table.readAt),
    createdAtIdx: index('notifications_created_at_idx').on(table.createdAt),
    typeIdx: index('notifications_type_idx').on(table.type),
  })
);

export const notificationDeliveries = pgTable(
  'notification_deliveries',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    notificationId: uuid('notification_id')
      .notNull()
      .references(() => notifications.id, { onDelete: 'cascade' }),
    channel: varchar('channel', { length: 50 }).notNull().default('in_app'), // e.g., 'in_app', 'email', 'sms'
    status: notificationDeliveryStatusEnum('status').notNull().default('pending'),
    error: text('error'), // Error message if delivery failed
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    notificationIdIdx: index('deliveries_notification_id_idx').on(table.notificationId),
    statusIdx: index('deliveries_status_idx').on(table.status),
    channelIdx: index('deliveries_channel_idx').on(table.channel),
  })
);

export const processedEvents = pgTable(
  'processed_events',
  {
    eventId: varchar('event_id', { length: 255 }).primaryKey(),
    processedAt: timestamp('processed_at').defaultNow().notNull(),
  },
  (table) => ({
    eventIdUnique: unique('processed_events_event_id_unique').on(table.eventId),
    processedAtIdx: index('processed_events_processed_at_idx').on(table.processedAt),
  })
);

export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;
export type NotificationDelivery = typeof notificationDeliveries.$inferSelect;
export type NewNotificationDelivery = typeof notificationDeliveries.$inferInsert;
export type ProcessedEvent = typeof processedEvents.$inferSelect;
export type NewProcessedEvent = typeof processedEvents.$inferInsert;

