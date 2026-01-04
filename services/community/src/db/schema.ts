import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  text,
  jsonb,
  pgEnum,
  boolean,
  index,
  unique,
} from 'drizzle-orm/pg-core';

// Enums
export const roleInBuildingEnum = pgEnum('role_in_building', [
  'resident',
  'admin',
]);

export const membershipStatusEnum = pgEnum('membership_status', [
  'verified', // can add 'pending' later
]);

export const postStatusEnum = pgEnum('post_status', [
  'active',
  'deleted',
]);

export const commentStatusEnum = pgEnum('comment_status', [
  'active',
  'deleted',
]);

// Membership Projection Table (local read model)
export const buildingMembershipsProjection = pgTable(
  'building_memberships_projection',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').notNull(), // References IAM users (no FK constraint)
    buildingId: uuid('building_id').notNull(), // References Buildings (no FK constraint)
    unitId: uuid('unit_id'), // References Units (no FK constraint, nullable)
    roleInBuilding: roleInBuildingEnum('role_in_building').notNull(),
    status: membershipStatusEnum('status').notNull().default('verified'),
    verifiedAt: timestamp('verified_at').notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index('projection_user_id_idx').on(table.userId),
    buildingIdIdx: index('projection_building_id_idx').on(table.buildingId),
    userBuildingIdx: index('projection_user_building_idx').on(
      table.userId,
      table.buildingId
    ),
    // Unique constraint: (userId, buildingId) - one membership per user per building
    projectionUnique: unique('projection_user_building_unique').on(
      table.userId,
      table.buildingId
    ),
  })
);

// Posts Table
export const posts = pgTable(
  'posts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    buildingId: uuid('building_id').notNull(), // References Buildings (no FK constraint)
    createdByUserId: uuid('created_by_user_id').notNull(), // References IAM users (no FK constraint)
    title: varchar('title', { length: 120 }), // Optional, nullable
    content: text('content').notNull(),
    status: postStatusEnum('status').notNull().default('active'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    buildingIdIdx: index('posts_building_id_idx').on(table.buildingId),
    createdByUserIdIdx: index('posts_created_by_user_id_idx').on(
      table.createdByUserId
    ),
    createdAtIdx: index('posts_created_at_idx').on(table.createdAt),
    buildingStatusIdx: index('posts_building_status_idx').on(
      table.buildingId,
      table.status
    ),
  })
);

// Comments Table
export const comments = pgTable(
  'comments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    postId: uuid('post_id')
      .notNull()
      .references(() => posts.id, { onDelete: 'cascade' }),
    buildingId: uuid('building_id').notNull(), // References Buildings (no FK constraint)
    createdByUserId: uuid('created_by_user_id').notNull(), // References IAM users (no FK constraint)
    content: text('content').notNull(),
    status: commentStatusEnum('status').notNull().default('active'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    postIdIdx: index('comments_post_id_idx').on(table.postId),
    buildingIdIdx: index('comments_building_id_idx').on(table.buildingId),
    createdByUserIdIdx: index('comments_created_by_user_id_idx').on(
      table.createdByUserId
    ),
    createdAtIdx: index('comments_created_at_idx').on(table.createdAt),
    postStatusIdx: index('comments_post_status_idx').on(
      table.postId,
      table.status
    ),
  })
);

// Outbox Events (same pattern as Tickets/IAM)
export const outboxEvents = pgTable('outbox_events', {
  id: uuid('id').defaultRandom().primaryKey(),
  eventId: varchar('event_id', { length: 255 }).notNull().unique(),
  eventType: varchar('event_type', { length: 255 }).notNull(),
  version: varchar('version', { length: 50 }).notNull(),
  payload: jsonb('payload').notNull(),
  published: boolean('published').default(false).notNull(),
  publishedAt: timestamp('published_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Processed Events (Idempotency)
export const processedEvents = pgTable(
  'processed_events',
  {
    eventId: varchar('event_id', { length: 255 }).primaryKey(),
    processedAt: timestamp('processed_at').defaultNow().notNull(),
  },
  (table) => ({
    eventIdUnique: unique('processed_events_event_id_unique').on(table.eventId),
    processedAtIdx: index('processed_events_processed_at_idx').on(
      table.processedAt
    ),
  })
);

// Type exports
export type BuildingMembershipProjection =
  typeof buildingMembershipsProjection.$inferSelect;
export type NewBuildingMembershipProjection =
  typeof buildingMembershipsProjection.$inferInsert;
export type Post = typeof posts.$inferSelect;
export type NewPost = typeof posts.$inferInsert;
export type Comment = typeof comments.$inferSelect;
export type NewComment = typeof comments.$inferInsert;
export type OutboxEvent = typeof outboxEvents.$inferSelect;
export type NewOutboxEvent = typeof outboxEvents.$inferInsert;
export type ProcessedEvent = typeof processedEvents.$inferSelect;
export type NewProcessedEvent = typeof processedEvents.$inferInsert;
