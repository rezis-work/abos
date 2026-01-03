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

export const ticketCategoryEnum = pgEnum('ticket_category', [
  'plumbing',
  'electric',
  'security',
  'noise',
  'other',
]);

export const ticketPriorityEnum = pgEnum('ticket_priority', [
  'low',
  'medium',
  'high',
  'urgent',
]);

export const ticketStatusEnum = pgEnum('ticket_status', [
  'open',
  'in_progress',
  'resolved',
  'closed',
]);

// Membership Projection Table (local read model)
export const buildingMembershipsProjection = pgTable(
  'building_memberships_projection',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').notNull(), // References IAM users (no FK constraint)
    buildingId: uuid('building_id').notNull(), // References Buildings (no FK constraint)
    unitId: uuid('unit_id').notNull(), // References Units (no FK constraint)
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
    // Unique constraint: (userId, buildingId, unitId) - matches Buildings pattern
    projectionUnique: unique('projection_user_building_unit_unique').on(
      table.userId,
      table.buildingId,
      table.unitId
    ),
  })
);

// Tickets Table
export const tickets = pgTable(
  'tickets',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    buildingId: uuid('building_id').notNull(), // References Buildings (no FK constraint)
    unitId: uuid('unit_id').notNull(), // References Units (no FK constraint)
    createdByUserId: uuid('created_by_user_id').notNull(), // References IAM users (no FK constraint)
    title: varchar('title', { length: 120 }).notNull(),
    description: text('description').notNull(),
    category: ticketCategoryEnum('category').notNull(),
    priority: ticketPriorityEnum('priority').notNull().default('medium'),
    status: ticketStatusEnum('status').notNull().default('open'),
    assignedToUserId: uuid('assigned_to_user_id'), // References IAM users (no FK constraint)
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    buildingIdIdx: index('tickets_building_id_idx').on(table.buildingId),
    unitIdIdx: index('tickets_unit_id_idx').on(table.unitId),
    createdByUserIdIdx: index('tickets_created_by_user_id_idx').on(
      table.createdByUserId
    ),
    assignedToUserIdIdx: index('tickets_assigned_to_user_id_idx').on(
      table.assignedToUserId
    ),
    statusIdx: index('tickets_status_idx').on(table.status),
    buildingStatusIdx: index('tickets_building_status_idx').on(
      table.buildingId,
      table.status
    ),
  })
);

// Ticket Events (Audit Timeline)
export const ticketEvents = pgTable(
  'ticket_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ticketId: uuid('ticket_id')
      .notNull()
      .references(() => tickets.id, { onDelete: 'cascade' }),
    type: varchar('type', { length: 60 }).notNull(), // 'created', 'assigned', 'status_changed', 'comment'
    data: jsonb('data'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    ticketIdIdx: index('ticket_events_ticket_id_idx').on(table.ticketId),
    typeIdx: index('ticket_events_type_idx').on(table.type),
    createdAtIdx: index('ticket_events_created_at_idx').on(table.createdAt),
  })
);

// Outbox Events (same pattern as IAM/Buildings)
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
export type Ticket = typeof tickets.$inferSelect;
export type NewTicket = typeof tickets.$inferInsert;
export type TicketEvent = typeof ticketEvents.$inferSelect;
export type NewTicketEvent = typeof ticketEvents.$inferInsert;
export type OutboxEvent = typeof outboxEvents.$inferSelect;
export type NewOutboxEvent = typeof outboxEvents.$inferInsert;
export type ProcessedEvent = typeof processedEvents.$inferSelect;
export type NewProcessedEvent = typeof processedEvents.$inferInsert;

