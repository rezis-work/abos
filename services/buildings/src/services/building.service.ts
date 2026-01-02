import { eq } from 'drizzle-orm';
import { db, buildings, outboxEvents, type Building } from '../db';
import { createEventId } from '@common/events';

export async function createBuilding(
  name: string,
  address: string,
  userId: string,
  correlationId?: string
): Promise<Building> {
  // Create event ID
  const eventId = await createEventId();

  // Use transaction to ensure atomicity
  const result = await db.transaction(async (tx) => {
    // Insert building
    const [newBuilding] = await tx
      .insert(buildings)
      .values({
        name,
        address,
      })
      .returning();

    // Insert outbox event with correlation ID
    await tx.insert(outboxEvents).values({
      eventId,
      eventType: 'building.created',
      version: 'v1',
      payload: {
        eventId,
        buildingId: newBuilding.id,
        name: newBuilding.name,
        address: newBuilding.address,
        createdAt: newBuilding.createdAt.toISOString(),
        occurredAt: newBuilding.createdAt.toISOString(),
        createdBy: userId,
        correlationId, // Store correlation ID in payload
      },
    });

    return newBuilding;
  });

  return result;
}

export async function getBuildingById(buildingId: string): Promise<Building | null> {
  const [building] = await db
    .select()
    .from(buildings)
    .where(eq(buildings.id, buildingId))
    .limit(1);

  return building || null;
}

export async function getAllBuildings(): Promise<Building[]> {
  return await db.select().from(buildings);
}

