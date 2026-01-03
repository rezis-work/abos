import { eq, and, desc, or } from 'drizzle-orm';
import { db, tickets, ticketEvents, outboxEvents, type Ticket, type TicketEvent } from '../db';
import { createEventId } from '@common/events';
import { getMembershipProjection } from './projection.service';
import { createLogger } from '@common/logger';

const logger = createLogger('ticket-service');

export interface CreateTicketInput {
  buildingId: string;
  userId: string;
  title: string;
  description: string;
  category: 'plumbing' | 'electric' | 'security' | 'noise' | 'other';
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  correlationId?: string;
}

export interface AssignTicketInput {
  ticketId: string;
  assignedToUserId: string | null;
  assignedByUserId: string;
  correlationId?: string;
}

export interface ChangeTicketStatusInput {
  ticketId: string;
  newStatus: 'open' | 'in_progress' | 'resolved' | 'closed';
  changedByUserId: string;
  correlationId?: string;
}

/**
 * Create a ticket with audit event and outbox event in a transaction.
 * Uses unitId from projection (don't trust client).
 */
export async function createTicket(
  input: CreateTicketInput
): Promise<Ticket> {
  // Get projection to get unitId
  const projection = await getMembershipProjection(input.userId, input.buildingId);
  if (!projection) {
    throw new Error('User does not have verified membership in this building');
  }

  const eventId = await createEventId();

  const result = await db.transaction(async (tx) => {
    // Insert ticket (use unitId from projection)
    const [newTicket] = await tx
      .insert(tickets)
      .values({
        buildingId: input.buildingId,
        unitId: projection.unitId, // From projection, not client
        createdByUserId: input.userId,
        title: input.title,
        description: input.description,
        category: input.category,
        priority: input.priority || 'medium',
        status: 'open',
      })
      .returning();

    // Insert ticket event (audit timeline)
    await tx.insert(ticketEvents).values({
      ticketId: newTicket.id,
      type: 'created',
      data: {
        createdByUserId: input.userId,
        title: input.title,
        category: input.category,
        priority: newTicket.priority,
      },
    });

    // Insert outbox event
    await tx.insert(outboxEvents).values({
      eventId,
      eventType: 'ticket.created',
      version: 'v1',
      payload: {
        ticketId: newTicket.id,
        buildingId: newTicket.buildingId,
        unitId: newTicket.unitId,
        createdByUserId: newTicket.createdByUserId,
        title: newTicket.title,
        category: newTicket.category,
        priority: newTicket.priority,
        status: newTicket.status,
        createdAt: newTicket.createdAt.toISOString(),
        occurredAt: newTicket.createdAt.toISOString(),
        correlationId: input.correlationId,
      },
    });

    logger.info('Ticket created', {
      ticketId: newTicket.id,
      buildingId: input.buildingId,
      userId: input.userId,
    });

    return newTicket;
  });

  return result;
}

/**
 * Get tickets for a building with filtering.
 * Admin sees all tickets, resident sees own + unit tickets.
 */
export async function getTicketsByBuilding(
  buildingId: string,
  userId: string,
  userRole: string,
  options?: {
    status?: 'open' | 'in_progress' | 'resolved' | 'closed';
    limit?: number;
    offset?: number;
  }
): Promise<Ticket[]> {
  const projection = await getMembershipProjection(userId, buildingId);
  const isAdmin = projection?.roleInBuilding === 'admin' || userRole === 'super_admin' || userRole === 'manager';

  // Build where conditions
  let whereConditions: any[] = [eq(tickets.buildingId, buildingId)];

  // Apply filters based on role
  if (!isAdmin) {
    // Resident: only their tickets OR tickets for their unit
    if (projection) {
      whereConditions.push(
        or(
          eq(tickets.createdByUserId, userId),
          eq(tickets.unitId, projection.unitId)
        )
      );
    } else {
      // No projection, only own tickets
      whereConditions.push(eq(tickets.createdByUserId, userId));
    }
  }

  // Apply status filter if provided
  if (options?.status) {
    whereConditions.push(eq(tickets.status, options.status));
  }

  // Build query with pagination
  const limit = options?.limit || 50;
  const offset = options?.offset || 0;

  return await db
    .select()
    .from(tickets)
    .where(and(...whereConditions))
    .orderBy(desc(tickets.createdAt))
    .limit(limit)
    .offset(offset);
}

/**
 * Get ticket by ID.
 */
export async function getTicketById(ticketId: string): Promise<Ticket | null> {
  const [ticket] = await db
    .select()
    .from(tickets)
    .where(eq(tickets.id, ticketId))
    .limit(1);

  return ticket || null;
}

/**
 * Assign ticket to a user.
 * Creates audit event and outbox event in transaction.
 */
export async function assignTicket(
  input: AssignTicketInput
): Promise<Ticket> {
  const eventId = await createEventId();
  const occurredAt = new Date();

  const result = await db.transaction(async (tx) => {
    // Get current ticket
    const [ticket] = await tx
      .select()
      .from(tickets)
      .where(eq(tickets.id, input.ticketId))
      .limit(1);

    if (!ticket) {
      throw new Error('Ticket not found');
    }

    // Update ticket
    const [updatedTicket] = await tx
      .update(tickets)
      .set({
        assignedToUserId: input.assignedToUserId,
        updatedAt: new Date(),
      })
      .where(eq(tickets.id, input.ticketId))
      .returning();

    // Insert ticket event
    await tx.insert(ticketEvents).values({
      ticketId: input.ticketId,
      type: 'assigned',
      data: {
        assignedToUserId: input.assignedToUserId,
        assignedByUserId: input.assignedByUserId,
        previousAssignedToUserId: ticket.assignedToUserId,
      },
    });

    // Insert outbox event
    await tx.insert(outboxEvents).values({
      eventId,
      eventType: 'ticket.assigned',
      version: 'v1',
      payload: {
        ticketId: input.ticketId,
        buildingId: ticket.buildingId,
        title: ticket.title, // Include title for better notification context
        assignedToUserId: input.assignedToUserId,
        assignedByUserId: input.assignedByUserId,
        occurredAt: occurredAt.toISOString(),
        correlationId: input.correlationId,
      },
    });

    logger.info('Ticket assigned', {
      ticketId: input.ticketId,
      assignedToUserId: input.assignedToUserId,
      assignedByUserId: input.assignedByUserId,
    });

    return updatedTicket;
  });

  return result;
}

/**
 * Change ticket status.
 * Creates audit event and outbox event in transaction.
 */
export async function changeTicketStatus(
  input: ChangeTicketStatusInput
): Promise<Ticket> {
  const eventId = await createEventId();
  const occurredAt = new Date();

  const result = await db.transaction(async (tx) => {
    // Get current ticket
    const [ticket] = await tx
      .select()
      .from(tickets)
      .where(eq(tickets.id, input.ticketId))
      .limit(1);

    if (!ticket) {
      throw new Error('Ticket not found');
    }

    const oldStatus = ticket.status;

    // Update ticket
    const [updatedTicket] = await tx
      .update(tickets)
      .set({
        status: input.newStatus,
        updatedAt: new Date(),
      })
      .where(eq(tickets.id, input.ticketId))
      .returning();

    // Insert ticket event
    await tx.insert(ticketEvents).values({
      ticketId: input.ticketId,
      type: 'status_changed',
      data: {
        oldStatus,
        newStatus: input.newStatus,
        changedByUserId: input.changedByUserId,
      },
    });

    // Insert outbox event
    await tx.insert(outboxEvents).values({
      eventId,
      eventType: 'ticket.status_changed',
      version: 'v1',
      payload: {
        ticketId: input.ticketId,
        buildingId: ticket.buildingId,
        createdByUserId: ticket.createdByUserId, // Include creator for notification
        oldStatus,
        newStatus: input.newStatus,
        changedByUserId: input.changedByUserId,
        occurredAt: occurredAt.toISOString(),
        correlationId: input.correlationId,
      },
    });

    logger.info('Ticket status changed', {
      ticketId: input.ticketId,
      oldStatus,
      newStatus: input.newStatus,
      changedByUserId: input.changedByUserId,
    });

    return updatedTicket;
  });

  return result;
}

/**
 * Get ticket events (audit timeline).
 */
export async function getTicketEvents(
  ticketId: string
): Promise<TicketEvent[]> {
  return await db
    .select()
    .from(ticketEvents)
    .where(eq(ticketEvents.ticketId, ticketId))
    .orderBy(desc(ticketEvents.createdAt));
}

