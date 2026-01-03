import { z } from 'zod';

// GET /notifications query params
export const getNotificationsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

// PATCH /notifications/:id/read params
export const notificationIdParamSchema = z.object({
  id: z.string().uuid('Invalid notification ID format'),
});

