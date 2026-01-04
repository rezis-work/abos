import { eq, and } from 'drizzle-orm';
import { db, buildingMembershipsProjection, processedEvents } from '../db';
import { createLogger } from '@common/logger';

const logger = createLogger('projection-service');

/**
 * Upsert membership projection with atomic idempotency.
 * Inserts processed_events first, then upserts projection.
 * Uses (userId, buildingId) as unique constraint (one membership per user per building).
 */
export async function upsertMembershipProjection(
  userId: string,
  buildingId: string,
  unitId: string | null,
  roleInBuilding: 'resident' | 'admin',
  verifiedAt: Date,
  eventId: string
): Promise<void> {
  await db.transaction(async (tx) => {
    // Try to insert processed_events first (atomic idempotency check)
    try {
      await tx.insert(processedEvents).values({
        eventId,
        processedAt: new Date(),
      });
    } catch (error: any) {
      // If unique constraint violation, event already processed
      if (error?.code === '23505') {
        logger.info('Event already processed, skipping projection update', { eventId });
        throw new Error('EVENT_ALREADY_PROCESSED');
      }
      // Re-throw other errors
      throw error;
    }

    // Upsert projection: update if exists, insert if not
    const existing = await tx
      .select()
      .from(buildingMembershipsProjection)
      .where(
        and(
          eq(buildingMembershipsProjection.userId, userId),
          eq(buildingMembershipsProjection.buildingId, buildingId)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      // Update existing projection
      await tx
        .update(buildingMembershipsProjection)
        .set({
          unitId,
          roleInBuilding,
          status: 'verified',
          verifiedAt,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(buildingMembershipsProjection.userId, userId),
            eq(buildingMembershipsProjection.buildingId, buildingId)
          )
        );

      logger.debug('Updated membership projection', {
        userId,
        buildingId,
        unitId,
        roleInBuilding,
      });
    } else {
      // Insert new projection
      await tx.insert(buildingMembershipsProjection).values({
        userId,
        buildingId,
        unitId,
        roleInBuilding,
        status: 'verified',
        verifiedAt,
        updatedAt: new Date(),
      });

      logger.debug('Created membership projection', {
        userId,
        buildingId,
        unitId,
        roleInBuilding,
      });
    }
  });
}

/**
 * Get membership projection for a user in a building.
 */
export async function getMembershipProjection(
  userId: string,
  buildingId: string
): Promise<typeof buildingMembershipsProjection.$inferSelect | null> {
  const [projection] = await db
    .select()
    .from(buildingMembershipsProjection)
    .where(
      and(
        eq(buildingMembershipsProjection.userId, userId),
        eq(buildingMembershipsProjection.buildingId, buildingId),
        eq(buildingMembershipsProjection.status, 'verified')
      )
    )
    .limit(1);

  return projection || null;
}

/**
 * Check if user has verified membership in building.
 */
export async function hasVerifiedMembership(
  userId: string,
  buildingId: string
): Promise<boolean> {
  const projection = await getMembershipProjection(userId, buildingId);
  return !!projection;
}

/**
 * Check if user is admin for building.
 */
export async function isBuildingAdmin(
  userId: string,
  buildingId: string,
  userRole: string
): Promise<boolean> {
  // Platform-level admins have access to all buildings
  if (userRole === 'super_admin' || userRole === 'manager') {
    return true;
  }

  // Check projection for admin role
  const projection = await getMembershipProjection(userId, buildingId);
  return projection?.roleInBuilding === 'admin';
}
