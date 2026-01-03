import { z } from 'zod';

export const buildingIdParamSchema = z.object({
  buildingId: z.string().uuid(),
});

export const ticketIdParamSchema = z.object({
  ticketId: z.string().uuid(),
});

export const createTicketSchema = z.object({
  title: z.string().min(3).max(120),
  description: z.string().min(3).max(5000),
  category: z.enum(['plumbing', 'electric', 'security', 'noise', 'other']),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional().default('medium'),
});

export const listTicketsQuerySchema = z.object({
  status: z.enum(['open', 'in_progress', 'resolved', 'closed']).optional(),
  limit: z.string().optional().default('50').transform(Number),
  offset: z.string().optional().default('0').transform(Number),
});

export const assignTicketSchema = z.object({
  assignedToUserId: z.string().uuid().nullable(),
});

export const changeTicketStatusSchema = z.object({
  status: z.enum(['open', 'in_progress', 'resolved', 'closed']),
});

