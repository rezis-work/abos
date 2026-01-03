import { z } from 'zod';

/**
 * Schema for user.created.v1 event payload
 * Note: correlationId is in BaseEvent metadata, not in payload
 */
export const userCreatedV1Schema = z.object({
  userId: z.string().uuid(),
  email: z.string().email(),
  role: z.string(),
  createdAt: z.string(),
});

/**
 * Schema for resident.verified.v1 event payload
 * Note: correlationId is in BaseEvent metadata, not in payload
 */
export const residentVerifiedV1Schema = z.object({
  eventId: z.string().uuid(),
  userId: z.string().uuid(),
  buildingId: z.string().uuid(),
  unitId: z.string().uuid(),
  roleInBuilding: z.enum(['resident', 'admin']),
  occurredAt: z.string(),
});

export type UserCreatedV1Payload = z.infer<typeof userCreatedV1Schema>;
export type ResidentVerifiedV1Payload = z.infer<typeof residentVerifiedV1Schema>;

