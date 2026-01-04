import { z } from "zod";

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
 * Note: eventId and correlationId are in BaseEvent metadata, not in payload
 */
export const residentVerifiedV1Schema = z.object({
  userId: z.string().uuid(),
  buildingId: z.string().uuid(),
  unitId: z.string().uuid(),
  roleInBuilding: z.enum(["resident", "admin"]),
  occurredAt: z.string(),
});

/**
 * Schema for ticket.created.v1 event payload
 * Note: eventId and correlationId are in BaseEvent metadata, not in payload
 */
export const ticketCreatedV1Schema = z.object({
  ticketId: z.string().uuid(),
  buildingId: z.string().uuid(),
  unitId: z.string().uuid(),
  createdByUserId: z.string().uuid(),
  title: z.string(),
  category: z.enum(["plumbing", "electric", "security", "noise", "other"]),
  priority: z.enum(["low", "medium", "high", "urgent"]),
  status: z.enum(["open", "in_progress", "resolved", "closed"]),
  createdAt: z.string(),
  occurredAt: z.string(),
});

/**
 * Schema for ticket.assigned.v1 event payload
 * Note: eventId and correlationId are in BaseEvent metadata, not in payload
 */
export const ticketAssignedV1Schema = z.object({
  ticketId: z.string().uuid(),
  buildingId: z.string().uuid(),
  title: z.string(), // Include title for better notification context
  assignedToUserId: z.string().uuid().nullable(),
  assignedByUserId: z.string().uuid(),
  occurredAt: z.string(),
});

/**
 * Schema for ticket.status_changed.v1 event payload
 * Note: eventId and correlationId are in BaseEvent metadata, not in payload
 */
export const ticketStatusChangedV1Schema = z.object({
  ticketId: z.string().uuid(),
  buildingId: z.string().uuid(),
  createdByUserId: z.string().uuid(),
  oldStatus: z.enum(["open", "in_progress", "resolved", "closed"]),
  newStatus: z.enum(["open", "in_progress", "resolved", "closed"]),
  changedByUserId: z.string().uuid(),
  occurredAt: z.string(),
});

export type UserCreatedV1Payload = z.infer<typeof userCreatedV1Schema>;
export type ResidentVerifiedV1Payload = z.infer<
  typeof residentVerifiedV1Schema
>;
export type TicketCreatedV1Payload = z.infer<typeof ticketCreatedV1Schema>;
export type TicketAssignedV1Payload = z.infer<typeof ticketAssignedV1Schema>;
export type TicketStatusChangedV1Payload = z.infer<
  typeof ticketStatusChangedV1Schema
>;

/**
 * Schema for comment.created.v1 event payload
 * Note: eventId and correlationId are in BaseEvent metadata, not in payload
 */
export const commentCreatedV1Schema = z.object({
  commentId: z.string().uuid(),
  postId: z.string().uuid(),
  buildingId: z.string().uuid(),
  createdByUserId: z.string().uuid(),
  postAuthorUserId: z.string().uuid(), // Include for notifications
  createdAt: z.string(),
  occurredAt: z.string(),
});

export type CommentCreatedV1Payload = z.infer<typeof commentCreatedV1Schema>;
