import { z } from 'zod';

export const buildingIdParamSchema = z.object({
  buildingId: z.string().uuid(),
});

export const visitorPassIdParamSchema = z.object({
  id: z.string().uuid(),
});

export const createVisitorPassSchema = z.object({
  visitorName: z.string().min(1).max(200),
  validFrom: z.string().datetime(),
  validTo: z.string().datetime(),
}).refine(
  (data) => new Date(data.validFrom) < new Date(data.validTo),
  {
    message: "validFrom must be before validTo",
    path: ["validTo"],
  }
);

export const listVisitorPassesQuerySchema = z.object({
  status: z.enum(['active', 'used', 'revoked']).optional(),
  limit: z.string().optional().default('50').transform(Number),
  offset: z.string().optional().default('0').transform(Number),
});

