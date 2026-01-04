import { eq, and } from 'drizzle-orm';
import { db, buildingMembershipsProjection, processedEvents } from '../db';
import { createLogger } from '@common/logger';

const logger = createLogger('projection-service');

/**
 * Upsert membership projection with atomic idempotency.
 * Inserts processed_events first, then upserts projection.
 * Note: Access service projection only stores userId, buildingId, role, verifiedAt
 * (unitId from event is not stored, as per plan)
 */
export async function upsertMembershipProjection(
  userId: string,
  buildingId: string,
  role: 'resident' | 'admin',
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
          role,
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
        role,
      });
    } else {
      // Insert new projection
      await tx.insert(buildingMembershipsProjection).values({
        userId,
        buildingId,
        role,
        verifiedAt,
        updatedAt: new Date(),
      });

      logger.debug('Created membership projection', {
        userId,
        buildingId,
        role,
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
        eq(buildingMembershipsProjection.buildingId, buildingId)
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

