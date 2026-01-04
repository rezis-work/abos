import { eq, and, desc } from 'drizzle-orm';
import { db, visitorPasses, visitorPassEvents, outboxEvents, type VisitorPass } from '../db';
import { createEventId } from '@common/events';
import { hasVerifiedMembership, getMembershipProjection } from './projection.service';
import { createLogger } from '@common/logger';

const logger = createLogger('visitor-pass-service');

export interface CreateVisitorPassInput {
  buildingId: string;
  residentId: string;
  visitorName: string;
  validFrom: Date;
  validTo: Date;
  correlationId?: string;
}

export interface ListVisitorPassesOptions {
  status?: 'active' | 'used' | 'revoked';
  limit?: number;
  offset?: number;
}

/**
 * Create a visitor pass with audit event and outbox event in a transaction.
 */
export async function createVisitorPass(
  input: CreateVisitorPassInput
): Promise<VisitorPass> {
  // Verify resident has membership
  const hasMembership = await hasVerifiedMembership(input.residentId, input.buildingId);
  if (!hasMembership) {
    throw new Error('User does not have verified membership in this building');
  }

  // Validate date range
  if (input.validFrom >= input.validTo) {
    throw new Error('validFrom must be before validTo');
  }

  const eventId = await createEventId();

  const result = await db.transaction(async (tx) => {
    // Insert visitor pass
    const [newPass] = await tx
      .insert(visitorPasses)
      .values({
        buildingId: input.buildingId,
        residentId: input.residentId,
        visitorName: input.visitorName,
        validFrom: input.validFrom,
        validTo: input.validTo,
        status: 'active',
      })
      .returning();

    // Insert visitor pass event (audit timeline)
    await tx.insert(visitorPassEvents).values({
      visitorPassId: newPass.id,
      type: 'created',
      metadata: {
        residentId: input.residentId,
        visitorName: input.visitorName,
        validFrom: input.validFrom.toISOString(),
        validTo: input.validTo.toISOString(),
      },
    });

    // Insert outbox event
    await tx.insert(outboxEvents).values({
      eventId,
      eventType: 'visitor_pass.created',
      version: 'v1',
      payload: {
        visitorPassId: newPass.id,
        buildingId: newPass.buildingId,
        residentId: newPass.residentId,
        visitorName: newPass.visitorName,
        validFrom: newPass.validFrom.toISOString(),
        validTo: newPass.validTo.toISOString(),
        status: newPass.status,
        createdAt: newPass.createdAt.toISOString(),
        correlationId: input.correlationId,
      },
    });

    logger.info('Visitor pass created', {
      visitorPassId: newPass.id,
      buildingId: input.buildingId,
      residentId: input.residentId,
    });

    return newPass;
  });

  return result;
}

/**
 * Get visitor passes for a resident in a building.
 */
export async function getMyVisitorPasses(
  buildingId: string,
  residentId: string,
  options?: ListVisitorPassesOptions
): Promise<VisitorPass[]> {
  // Verify resident has membership
  const hasMembership = await hasVerifiedMembership(residentId, buildingId);
  if (!hasMembership) {
    throw new Error('User does not have verified membership in this building');
  }

  // Build where conditions
  const whereConditions: any[] = [
    eq(visitorPasses.buildingId, buildingId),
    eq(visitorPasses.residentId, residentId),
  ];

  // Apply status filter if provided
  if (options?.status) {
    whereConditions.push(eq(visitorPasses.status, options.status));
  }

  // Build query with pagination
  const limit = options?.limit || 50;
  const offset = options?.offset || 0;

  return await db
    .select()
    .from(visitorPasses)
    .where(and(...whereConditions))
    .orderBy(desc(visitorPasses.createdAt))
    .limit(limit)
    .offset(offset);
}

/**
 * Get visitor pass by ID.
 */
export async function getVisitorPassById(visitorPassId: string): Promise<VisitorPass | null> {
  const [pass] = await db
    .select()
    .from(visitorPasses)
    .where(eq(visitorPasses.id, visitorPassId))
    .limit(1);

  return pass || null;
}

/**
 * Revoke a visitor pass.
 * Only the owner (residentId) can revoke, and only if status is 'active'.
 */
export async function revokeVisitorPass(
  visitorPassId: string,
  userId: string,
  correlationId?: string
): Promise<VisitorPass> {
  const eventId = await createEventId();

  const result = await db.transaction(async (tx) => {
    // Get current pass
    const [pass] = await tx
      .select()
      .from(visitorPasses)
      .where(eq(visitorPasses.id, visitorPassId))
      .limit(1);

    if (!pass) {
      throw new Error('Visitor pass not found');
    }

    // Check ownership
    if (pass.residentId !== userId) {
      throw new Error('You can only revoke your own visitor passes');
    }

    // Check status
    if (pass.status !== 'active') {
      throw new Error('Only active visitor passes can be revoked');
    }

    // Update pass
    const [updatedPass] = await tx
      .update(visitorPasses)
      .set({
        status: 'revoked',
      })
      .where(eq(visitorPasses.id, visitorPassId))
      .returning();

    // Insert visitor pass event
    await tx.insert(visitorPassEvents).values({
      visitorPassId: visitorPassId,
      type: 'revoked',
      metadata: {
        revokedBy: userId,
        revokedAt: new Date().toISOString(),
      },
    });

    // Insert outbox event
    await tx.insert(outboxEvents).values({
      eventId,
      eventType: 'visitor_pass.revoked',
      version: 'v1',
      payload: {
        visitorPassId: visitorPassId,
        buildingId: pass.buildingId,
        residentId: pass.residentId,
        visitorName: pass.visitorName,
        revokedBy: userId,
        occurredAt: new Date().toISOString(),
        correlationId,
      },
    });

    logger.info('Visitor pass revoked', {
      visitorPassId,
      residentId: pass.residentId,
    });

    return updatedPass;
  });

  return result;
}

/**
 * Mark visitor pass as used.
 * Only admin/guard can mark as used, and only if status is 'active' and within valid time window.
 */
export async function markVisitorPassUsed(
  visitorPassId: string,
  userId: string,
  userRole: string,
  buildingId: string,
  correlationId?: string
): Promise<VisitorPass> {
  const eventId = await createEventId();
  const now = new Date();

  const result = await db.transaction(async (tx) => {
    // Get current pass
    const [pass] = await tx
      .select()
      .from(visitorPasses)
      .where(eq(visitorPasses.id, visitorPassId))
      .limit(1);

    if (!pass) {
      throw new Error('Visitor pass not found');
    }

    // Verify building matches
    if (pass.buildingId !== buildingId) {
      throw new Error('Visitor pass does not belong to this building');
    }

    // Check status
    if (pass.status !== 'active') {
      throw new Error('Only active visitor passes can be marked as used');
    }

    // Check time window
    if (now < pass.validFrom || now > pass.validTo) {
      throw new Error('Visitor pass is not valid at this time');
    }

    // Check admin/guard role
    // Platform-level admins always have access
    if (userRole !== 'super_admin' && userRole !== 'manager') {
      // Check building-level admin from projection
      const projection = await getMembershipProjection(userId, buildingId);
      if (!projection || projection.role !== 'admin') {
        // Check if user has guard role (would need to be defined in IAM)
        if (userRole !== 'guard' && userRole !== 'building_admin') {
          throw new Error('Only admins or guards can mark visitor passes as used');
        }
      }
    }

    // Update pass
    const [updatedPass] = await tx
      .update(visitorPasses)
      .set({
        status: 'used',
      })
      .where(eq(visitorPasses.id, visitorPassId))
      .returning();

    // Insert visitor pass event
    await tx.insert(visitorPassEvents).values({
      visitorPassId: visitorPassId,
      type: 'used',
      metadata: {
        usedBy: userId,
        usedAt: now.toISOString(),
      },
    });

    // Insert outbox event for visitor_pass.used.v1
    await tx.insert(outboxEvents).values({
      eventId,
      eventType: 'visitor_pass.used',
      version: 'v1',
      payload: {
        visitorPassId: visitorPassId,
        buildingId: pass.buildingId,
        residentId: pass.residentId,
        visitorName: pass.visitorName,
        usedBy: userId,
        occurredAt: now.toISOString(),
        correlationId,
      },
    });

    // Insert outbox event for notification.send.v1
    const notificationEventId = await createEventId();
    await tx.insert(outboxEvents).values({
      eventId: notificationEventId,
      eventType: 'notification.send',
      version: 'v1',
      payload: {
        userId: pass.residentId,
        type: 'visitor_pass_used',
        title: 'Visitor pass used',
        body: `Your visitor pass for "${pass.visitorName}" has been used.`,
        data: {
          visitorPassId: visitorPassId,
          buildingId: pass.buildingId,
          visitorName: pass.visitorName,
          usedAt: now.toISOString(),
        },
        correlationId,
      },
    });

    logger.info('Visitor pass marked as used', {
      visitorPassId,
      residentId: pass.residentId,
      usedBy: userId,
    });

    return updatedPass;
  });

  return result;
}

