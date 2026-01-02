import { eq } from 'drizzle-orm';
import { db, units, outboxEvents, type Unit } from '../db';
import { createEventId } from '@common/events';
import { getBuildingById } from './building.service';

export interface CreateUnitInput {
  unitNumber: string;
  floor?: number | null;
}

export async function createUnits(
  buildingId: string,
  unitsToCreate: CreateUnitInput[],
  userId: string,
  correlationId?: string
): Promise<Unit[]> {
  // Verify building exists
  const building = await getBuildingById(buildingId);
  if (!building) {
    throw new Error('Building not found');
  }

  // Use transaction to ensure atomicity
  const result = await db.transaction(async (tx) => {
    const createdUnits: Unit[] = [];

    // Create units and events
    for (const unitInput of unitsToCreate) {
      const eventId = await createEventId();

      // Insert unit
      const [newUnit] = await tx
        .insert(units)
        .values({
          buildingId,
          unitNumber: unitInput.unitNumber,
          floor: unitInput.floor ?? null,
        })
        .returning();

      createdUnits.push(newUnit);

      // Insert outbox event for each unit (or could be bulk event)
      await tx.insert(outboxEvents).values({
        eventId,
        eventType: 'unit.created',
        version: 'v1',
        payload: {
          eventId,
          unitId: newUnit.id,
          buildingId: newUnit.buildingId,
          unitNumber: newUnit.unitNumber,
          floor: newUnit.floor,
          createdAt: newUnit.createdAt.toISOString(),
          occurredAt: newUnit.createdAt.toISOString(),
          createdBy: userId,
          correlationId, // Store correlation ID in payload
        },
      });
    }

    return createdUnits;
  });

  return result;
}

export async function getUnitsByBuilding(
  buildingId: string
): Promise<Unit[]> {
  // Verify building exists
  const building = await getBuildingById(buildingId);
  if (!building) {
    throw new Error('Building not found');
  }

  // Get all units for the building
  const unitsList = await db
    .select()
    .from(units)
    .where(eq(units.buildingId, buildingId));

  return unitsList;
}

