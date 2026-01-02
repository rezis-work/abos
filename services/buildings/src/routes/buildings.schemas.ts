import { z } from 'zod';

// POST /buildings
export const createBuildingSchema = z.object({
  name: z.string().min(1, 'Building name is required').max(255),
  address: z.string().min(1, 'Address is required').max(500),
});

// POST /buildings/:buildingId/units
export const createUnitsSchema = z.object({
  units: z
    .array(
      z.object({
        unitNumber: z.string().min(1, 'Unit number is required').max(50),
        floor: z.number().int().nullable().optional(),
      })
    )
    .min(1, 'At least one unit is required'),
});

// POST /buildings/:buildingId/memberships
export const createMembershipSchema = z.object({
  unitId: z.string().uuid('Invalid unit ID format'),
  userId: z.string().uuid('Invalid user ID format'),
  status: z.enum(['pending', 'verified', 'rejected']),
  roleInBuilding: z.enum(['resident', 'admin']),
});

// POST /buildings/:buildingId/request-access
export const requestAccessSchema = z.object({
  unitId: z.string().uuid('Invalid unit ID format'),
});

// Params schemas
export const buildingIdParamSchema = z.object({
  buildingId: z.string().uuid('Invalid building ID format'),
});

export const membershipIdParamSchema = z.object({
  membershipId: z.string().uuid('Invalid membership ID format'),
});

