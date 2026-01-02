import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  boolean,
  jsonb,
  pgEnum,
  integer,
  index,
  unique,
} from 'drizzle-orm/pg-core';

export const membershipStatusEnum = pgEnum('membership_status', [
  'pending',
  'verified',
  'rejected',
]);

export const roleInBuildingEnum = pgEnum('role_in_building', [
  'resident',
  'admin',
]);

export const buildings = pgTable(
  'buildings',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 255 }).notNull(),
    address: varchar('address', { length: 500 }).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    nameIdx: index('buildings_name_idx').on(table.name),
  })
);

export const units = pgTable(
  'units',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    buildingId: uuid('building_id')
      .notNull()
      .references(() => buildings.id, { onDelete: 'cascade' }),
    unitNumber: varchar('unit_number', { length: 50 }).notNull(),
    floor: integer('floor'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    buildingIdIdx: index('units_building_id_idx').on(table.buildingId),
    // Unique constraint: (buildingId, unitNumber)
    buildingUnitUnique: unique('units_building_unit_unique').on(
      table.buildingId,
      table.unitNumber
    ),
  })
);

export const memberships = pgTable(
  'memberships',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    buildingId: uuid('building_id')
      .notNull()
      .references(() => buildings.id, { onDelete: 'cascade' }),
    unitId: uuid('unit_id')
      .notNull()
      .references(() => units.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').notNull(), // References IAM users (no FK constraint)
    status: membershipStatusEnum('status').notNull().default('pending'),
    roleInBuilding: roleInBuildingEnum('role_in_building')
      .notNull()
      .default('resident'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    verifiedAt: timestamp('verified_at'),
  },
  (table) => ({
    // Composite index: (userId, buildingId, status)
    userBuildingStatusIdx: index('memberships_user_building_status_idx').on(
      table.userId,
      table.buildingId,
      table.status
    ),
    buildingIdIdx: index('memberships_building_id_idx').on(table.buildingId),
    unitIdIdx: index('memberships_unit_id_idx').on(table.unitId),
    userIdIdx: index('memberships_user_id_idx').on(table.userId),
    // Unique constraint: (buildingId, unitId, userId) - prevents duplicate memberships
    // This ensures a user can only have one membership per unit per building
    membershipUnique: unique('memberships_building_unit_user_unique').on(
      table.buildingId,
      table.unitId,
      table.userId
    ),
  })
);

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

export type Building = typeof buildings.$inferSelect;
export type NewBuilding = typeof buildings.$inferInsert;
export type Unit = typeof units.$inferSelect;
export type NewUnit = typeof units.$inferInsert;
export type Membership = typeof memberships.$inferSelect;
export type NewMembership = typeof memberships.$inferInsert;
export type OutboxEvent = typeof outboxEvents.$inferSelect;
export type NewOutboxEvent = typeof outboxEvents.$inferInsert;

