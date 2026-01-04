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

export const visitorPassStatusEnum = pgEnum('visitor_pass_status', [
  'active',
  'used',
  'revoked',
]);

// Membership Projection Table (local read model)
export const buildingMembershipsProjection = pgTable(
  'building_memberships_projection',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').notNull(), // References IAM users (no FK constraint)
    buildingId: uuid('building_id').notNull(), // References Buildings (no FK constraint)
    role: roleInBuildingEnum('role').notNull(),
    verifiedAt: timestamp('verified_at', { withTimezone: true }).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index('access_projection_user_id_idx').on(table.userId),
    buildingIdIdx: index('access_projection_building_id_idx').on(table.buildingId),
    userBuildingIdx: index('access_projection_user_building_idx').on(
      table.userId,
      table.buildingId
    ),
    // Unique constraint: (userId, buildingId)
    projectionUnique: unique('access_projection_user_building_unique').on(
      table.userId,
      table.buildingId
    ),
  })
);

// Visitor Passes Table
export const visitorPasses = pgTable(
  'visitor_passes',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    buildingId: uuid('building_id').notNull(), // References Buildings (no FK constraint)
    residentId: uuid('resident_id').notNull(), // References IAM users (no FK constraint)
    visitorName: text('visitor_name').notNull(),
    validFrom: timestamp('valid_from', { withTimezone: true }).notNull(),
    validTo: timestamp('valid_to', { withTimezone: true }).notNull(),
    status: visitorPassStatusEnum('status').notNull().default('active'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    buildingIdIdx: index('visitor_passes_building_id_idx').on(table.buildingId),
    residentIdIdx: index('visitor_passes_resident_id_idx').on(table.residentId),
    statusIdx: index('visitor_passes_status_idx').on(table.status),
    residentBuildingIdx: index('visitor_passes_resident_building_idx').on(
      table.residentId,
      table.buildingId
    ),
  })
);

// Visitor Pass Events (Audit Timeline)
export const visitorPassEvents = pgTable(
  'visitor_pass_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    visitorPassId: uuid('visitor_pass_id')
      .notNull()
      .references(() => visitorPasses.id, { onDelete: 'cascade' }),
    type: varchar('type', { length: 60 }).notNull(), // 'created', 'used', 'revoked'
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    visitorPassIdIdx: index('visitor_pass_events_visitor_pass_id_idx').on(table.visitorPassId),
    typeIdx: index('visitor_pass_events_type_idx').on(table.type),
    createdAtIdx: index('visitor_pass_events_created_at_idx').on(table.createdAt),
  })
);

// Outbox Events (same pattern as other services)
export const outboxEvents = pgTable('outbox_events', {
  id: uuid('id').defaultRandom().primaryKey(),
  eventId: varchar('event_id', { length: 255 }).notNull().unique(),
  eventType: varchar('event_type', { length: 255 }).notNull(),
  version: varchar('version', { length: 50 }).notNull(),
  payload: jsonb('payload').notNull(),
  published: boolean('published').default(false).notNull(),
  publishedAt: timestamp('published_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// Processed Events (Idempotency)
export const processedEvents = pgTable(
  'processed_events',
  {
    eventId: varchar('event_id', { length: 255 }).primaryKey(),
    processedAt: timestamp('processed_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    eventIdUnique: unique('access_processed_events_event_id_unique').on(table.eventId),
    processedAtIdx: index('access_processed_events_processed_at_idx').on(
      table.processedAt
    ),
  })
);

// Type exports
export type BuildingMembershipProjection =
  typeof buildingMembershipsProjection.$inferSelect;
export type NewBuildingMembershipProjection =
  typeof buildingMembershipsProjection.$inferInsert;
export type VisitorPass = typeof visitorPasses.$inferSelect;
export type NewVisitorPass = typeof visitorPasses.$inferInsert;
export type VisitorPassEvent = typeof visitorPassEvents.$inferSelect;
export type NewVisitorPassEvent = typeof visitorPassEvents.$inferInsert;
export type OutboxEvent = typeof outboxEvents.$inferSelect;
export type NewOutboxEvent = typeof outboxEvents.$inferInsert;
export type ProcessedEvent = typeof processedEvents.$inferSelect;
export type NewProcessedEvent = typeof processedEvents.$inferInsert;
