import { eq, and } from "drizzle-orm";
import { db, memberships, units, outboxEvents, type Membership } from "../db";
import { createEventId } from "@common/events";
import { getBuildingById } from "./building.service";

export async function createMembership(
  buildingId: string,
  unitId: string,
  userId: string,
  status: "pending" | "verified" | "rejected",
  roleInBuilding: "resident" | "admin",
  correlationId?: string
): Promise<Membership> {
  // Verify building exists
  const building = await getBuildingById(buildingId);
  if (!building) {
    throw new Error("Building not found");
  }

  // Verify unit exists and belongs to building
  const [unit] = await db
    .select()
    .from(units)
    .where(and(eq(units.id, unitId), eq(units.buildingId, buildingId)))
    .limit(1);

  if (!unit) {
    throw new Error("Unit not found or does not belong to building");
  }

  // Check if membership already exists
  const [existingMembership] = await db
    .select()
    .from(memberships)
    .where(
      and(
        eq(memberships.buildingId, buildingId),
        eq(memberships.unitId, unitId),
        eq(memberships.userId, userId)
      )
    )
    .limit(1);

  // If membership exists, update it instead of creating a new one
  if (existingMembership) {
    const wasVerified = existingMembership.status === "verified";
    const willBeVerified = status === "verified";

    // Create event ID
    const eventId = await createEventId();

    // Use transaction to ensure atomicity
    const result = await db.transaction(async (tx) => {
      // Update existing membership
      const [updatedMembership] = await tx
        .update(memberships)
        .set({
          status,
          roleInBuilding,
          verifiedAt:
            status === "verified" ? new Date() : existingMembership.verifiedAt,
        })
        .where(eq(memberships.id, existingMembership.id))
        .returning();

      // Only publish membership.created event if this is a new status change
      if (existingMembership.status !== status) {
        await tx.insert(outboxEvents).values({
          eventId,
          eventType: "membership.created",
          version: "v1",
          payload: {
            eventId,
            membershipId: updatedMembership.id,
            buildingId: updatedMembership.buildingId,
            unitId: updatedMembership.unitId,
            userId: updatedMembership.userId,
            status: updatedMembership.status,
            roleInBuilding: updatedMembership.roleInBuilding,
            createdAt: updatedMembership.createdAt.toISOString(),
            occurredAt: new Date().toISOString(),
            correlationId, // Store correlation ID in payload
          },
        });
      }

      // If status changed to verified (and wasn't verified before), publish resident.verified.v1 event
      if (!wasVerified && willBeVerified) {
        const verifiedEventId = await createEventId();
        await tx.insert(outboxEvents).values({
          eventId: verifiedEventId,
          eventType: "resident.verified",
          version: "v1",
          payload: {
            eventId: verifiedEventId,
            userId: updatedMembership.userId,
            buildingId: updatedMembership.buildingId,
            unitId: updatedMembership.unitId,
            roleInBuilding: updatedMembership.roleInBuilding,
            occurredAt:
              updatedMembership.verifiedAt?.toISOString() ||
              new Date().toISOString(),
            correlationId, // Store correlation ID in payload
          },
        });
      }

      return updatedMembership;
    });

    return result;
  }

  // Create event ID for new membership
  const eventId = await createEventId();

  // Use transaction to ensure atomicity
  const result = await db.transaction(async (tx) => {
    // Insert new membership
    const [newMembership] = await tx
      .insert(memberships)
      .values({
        buildingId,
        unitId,
        userId,
        status,
        roleInBuilding,
        verifiedAt: status === "verified" ? new Date() : null,
      })
      .returning();

    // Insert outbox event
    await tx.insert(outboxEvents).values({
      eventId,
      eventType: "membership.created",
      version: "v1",
      payload: {
        eventId,
        membershipId: newMembership.id,
        buildingId: newMembership.buildingId,
        unitId: newMembership.unitId,
        userId: newMembership.userId,
        status: newMembership.status,
        roleInBuilding: newMembership.roleInBuilding,
        createdAt: newMembership.createdAt.toISOString(),
        occurredAt: newMembership.createdAt.toISOString(),
        correlationId, // Store correlation ID in payload
      },
    });

    // If status is verified, also publish resident.verified.v1 event
    if (status === "verified") {
      const verifiedEventId = await createEventId();
      await tx.insert(outboxEvents).values({
        eventId: verifiedEventId,
        eventType: "resident.verified",
        version: "v1",
        payload: {
          eventId: verifiedEventId,
          userId: newMembership.userId,
          buildingId: newMembership.buildingId,
          unitId: newMembership.unitId,
          roleInBuilding: newMembership.roleInBuilding,
          occurredAt:
            newMembership.verifiedAt?.toISOString() || new Date().toISOString(),
          correlationId, // Store correlation ID in payload
        },
      });
    }

    return newMembership;
  });

  return result;
}

export async function requestAccess(
  buildingId: string,
  unitId: string,
  userId: string,
  correlationId?: string
): Promise<Membership> {
  // Check if membership already exists
  const [existing] = await db
    .select()
    .from(memberships)
    .where(
      and(
        eq(memberships.buildingId, buildingId),
        eq(memberships.unitId, unitId),
        eq(memberships.userId, userId)
      )
    )
    .limit(1);

  if (existing) {
    throw new Error("Membership request already exists");
  }

  // Create pending membership
  return createMembership(
    buildingId,
    unitId,
    userId,
    "pending",
    "resident",
    correlationId
  );
}

export async function verifyMembership(
  membershipId: string,
  correlationId?: string
): Promise<Membership> {
  // Find membership
  const [membership] = await db
    .select()
    .from(memberships)
    .where(eq(memberships.id, membershipId))
    .limit(1);

  if (!membership) {
    throw new Error("Membership not found");
  }

  if (membership.status === "verified") {
    return membership; // Already verified
  }

  // Create event ID for resident.verified
  const verifiedEventId = await createEventId();

  // Use transaction to ensure atomicity
  const result = await db.transaction(async (tx) => {
    // Update membership to verified
    const [updatedMembership] = await tx
      .update(memberships)
      .set({
        status: "verified",
        verifiedAt: new Date(),
      })
      .where(eq(memberships.id, membershipId))
      .returning();

    // Publish resident.verified.v1 event (critical event)
    await tx.insert(outboxEvents).values({
      eventId: verifiedEventId,
      eventType: "resident.verified",
      version: "v1",
      payload: {
        eventId: verifiedEventId,
        userId: updatedMembership.userId,
        buildingId: updatedMembership.buildingId,
        unitId: updatedMembership.unitId,
        roleInBuilding: updatedMembership.roleInBuilding,
        occurredAt:
          updatedMembership.verifiedAt?.toISOString() ||
          new Date().toISOString(),
        correlationId, // Store correlation ID in payload
      },
    });

    return updatedMembership;
  });

  return result;
}

export async function getPendingMemberships(
  buildingId: string
): Promise<Membership[]> {
  // Verify building exists
  const building = await getBuildingById(buildingId);
  if (!building) {
    throw new Error("Building not found");
  }

  // Find all pending memberships for the building
  return await db
    .select()
    .from(memberships)
    .where(
      and(
        eq(memberships.buildingId, buildingId),
        eq(memberships.status, "pending")
      )
    );
}

export async function getMyMembership(
  buildingId: string,
  userId: string
): Promise<Membership | null> {
  // Verify building exists
  const building = await getBuildingById(buildingId);
  if (!building) {
    throw new Error("Building not found");
  }

  // Find membership
  const [membership] = await db
    .select()
    .from(memberships)
    .where(
      and(
        eq(memberships.buildingId, buildingId),
        eq(memberships.userId, userId)
      )
    )
    .limit(1);

  return membership || null;
}

/**
 * Check if a user has admin access to a specific building.
 * Returns true if:
 * - User has a verified membership in the building with roleInBuilding = 'admin'
 * - User is super_admin or manager (platform-level admins)
 */
export async function hasBuildingAdminAccess(
  buildingId: string,
  userId: string,
  userRole: string
): Promise<boolean> {
  // Platform-level admins have access to all buildings
  if (userRole === "super_admin" || userRole === "manager") {
    return true;
  }

  // For building_admin role, check if they have admin membership in this building
  if (userRole === "building_admin") {
    const [membership] = await db
      .select()
      .from(memberships)
      .where(
        and(
          eq(memberships.buildingId, buildingId),
          eq(memberships.userId, userId),
          eq(memberships.status, "verified"),
          eq(memberships.roleInBuilding, "admin")
        )
      )
      .limit(1);

    return !!membership;
  }

  return false;
}
