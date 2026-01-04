import { z } from "zod";

/**
 * Schema for resident.verified.v1 event payload
 * Note: eventId and correlationId are in BaseEvent metadata, not in payload
 */
export const residentVerifiedV1Schema = z.object({
  userId: z.string().uuid(),
  buildingId: z.string().uuid(),
  unitId: z.string().uuid(),
  roleInBuilding: z.enum(["resident", "admin"]),
  occurredAt: z.string(),
});

export type ResidentVerifiedV1Payload = z.infer<
  typeof residentVerifiedV1Schema
>;

