import { Router, Response } from 'express';
import {
  asyncHandler,
  validateBody,
  RequestWithId,
} from '@common/http';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import {
  requireSuperAdminOrManager,
  requireBuildingAdmin,
} from '../middleware/authorize';
import {
  createBuildingSchema,
  createUnitsSchema,
  createMembershipSchema,
  requestAccessSchema,
  buildingIdParamSchema,
  membershipIdParamSchema,
} from './buildings.schemas';
import { createBuilding, getBuildingById, getAllBuildings } from '../services/building.service';
import {
  createUnits,
  getUnitsByBuilding,
} from '../services/unit.service';
import {
  createMembership,
  requestAccess,
  getMyMembership,
  verifyMembership,
  getPendingMemberships,
} from '../services/membership.service';
import { eq, and } from 'drizzle-orm';
import { db, memberships } from '../db';

const router: Router = Router();

// GET /buildings - List all buildings (super_admin/manager only)
// Note: building_admin cannot list all buildings, only their own building
router.get(
  '/',
  authenticate,
  requireSuperAdminOrManager(),
  asyncHandler(async (_req: AuthenticatedRequest & RequestWithId, res: Response) => {
    const buildingsList = await getAllBuildings();

    res.json({
      buildings: buildingsList.map((building) => ({
        id: building.id,
        name: building.name,
        address: building.address,
        createdAt: building.createdAt,
      })),
    });
  })
);

// GET /buildings/:buildingId - Get building by ID
router.get(
  '/:buildingId',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest & RequestWithId, res: Response) => {
    const { buildingId } = req.params;

    // Validate buildingId param
    const paramResult = buildingIdParamSchema.safeParse({ buildingId });
    if (!paramResult.success) {
      const error = new Error('Invalid building ID format');
      (error as any).statusCode = 400;
      (error as any).code = 'VALIDATION_ERROR';
      throw error;
    }

    const building = await getBuildingById(buildingId);

    if (!building) {
      res.status(404).json({
        error: {
          message: 'Building not found',
          code: 'NOT_FOUND',
          statusCode: 404,
        },
      });
      return;
    }

    res.json({
      id: building.id,
      name: building.name,
      address: building.address,
      createdAt: building.createdAt,
    });
  })
);

// POST /buildings - Create building (super_admin/manager only)
router.post(
  '/',
  authenticate,
  requireSuperAdminOrManager(),
  validateBody(createBuildingSchema),
  asyncHandler(async (req: AuthenticatedRequest & RequestWithId, res: Response) => {
    const { name, address } = req.body;
    const userId = req.user!.userId;

    const building = await createBuilding(name, address, userId, req.requestId);

    res.status(201).json({
      id: building.id,
      name: building.name,
      address: building.address,
      createdAt: building.createdAt,
    });
  })
);

// POST /buildings/:buildingId/units - Bulk create units (building_admin/super_admin/manager)
router.post(
  '/:buildingId/units',
  authenticate,
  requireBuildingAdmin(),
  validateBody(createUnitsSchema),
  asyncHandler(async (req: AuthenticatedRequest & RequestWithId, res: Response) => {
    const { buildingId } = req.params;
    const { units: unitsToCreate } = req.body;
    const userId = req.user!.userId;

    // Validate buildingId param
    const paramResult = buildingIdParamSchema.safeParse({ buildingId });
    if (!paramResult.success) {
      const error = new Error('Invalid building ID format');
      (error as any).statusCode = 400;
      (error as any).code = 'VALIDATION_ERROR';
      throw error;
    }

    const units = await createUnits(
      buildingId,
      unitsToCreate,
      userId,
      req.requestId
    );

    res.status(201).json({
      units: units.map((unit) => ({
        id: unit.id,
        buildingId: unit.buildingId,
        unitNumber: unit.unitNumber,
        floor: unit.floor,
        createdAt: unit.createdAt,
      })),
    });
  })
);

// GET /buildings/:buildingId/units - List units (admin only)
router.get(
  '/:buildingId/units',
  authenticate,
  requireBuildingAdmin(),
  asyncHandler(async (req: AuthenticatedRequest & RequestWithId, res: Response) => {
    const { buildingId } = req.params;

    // Validate buildingId param
    const paramResult = buildingIdParamSchema.safeParse({ buildingId });
    if (!paramResult.success) {
      const error = new Error('Invalid building ID format');
      (error as any).statusCode = 400;
      (error as any).code = 'VALIDATION_ERROR';
      throw error;
    }

    const units = await getUnitsByBuilding(buildingId);

    res.json({
      units: units.map((unit) => ({
        id: unit.id,
        buildingId: unit.buildingId,
        unitNumber: unit.unitNumber,
        floor: unit.floor,
        createdAt: unit.createdAt,
      })),
    });
  })
);

// POST /buildings/:buildingId/memberships - Assign user to unit (building_admin/super_admin/manager)
router.post(
  '/:buildingId/memberships',
  authenticate,
  requireBuildingAdmin(),
  validateBody(createMembershipSchema),
  asyncHandler(async (req: AuthenticatedRequest & RequestWithId, res: Response) => {
    const { buildingId } = req.params;
    const { unitId, userId, status, roleInBuilding } = req.body;

    // Validate buildingId param
    const paramResult = buildingIdParamSchema.safeParse({ buildingId });
    if (!paramResult.success) {
      const error = new Error('Invalid building ID format');
      (error as any).statusCode = 400;
      (error as any).code = 'VALIDATION_ERROR';
      throw error;
    }

    const membership = await createMembership(
      buildingId,
      unitId,
      userId,
      status,
      roleInBuilding,
      req.requestId
    );

    res.status(201).json({
      id: membership.id,
      buildingId: membership.buildingId,
      unitId: membership.unitId,
      userId: membership.userId,
      status: membership.status,
      roleInBuilding: membership.roleInBuilding,
      createdAt: membership.createdAt,
      verifiedAt: membership.verifiedAt,
    });
  })
);

// POST /buildings/:buildingId/request-access - Request access (creates pending membership)
router.post(
  '/:buildingId/request-access',
  authenticate,
  validateBody(requestAccessSchema),
  asyncHandler(async (req: AuthenticatedRequest & RequestWithId, res: Response) => {
    const { buildingId } = req.params;
    const { unitId } = req.body;
    const userId = req.user!.userId;

    // Validate buildingId param
    const paramResult = buildingIdParamSchema.safeParse({ buildingId });
    if (!paramResult.success) {
      const error = new Error('Invalid building ID format');
      (error as any).statusCode = 400;
      (error as any).code = 'VALIDATION_ERROR';
      throw error;
    }

    const membership = await requestAccess(
      buildingId,
      unitId,
      userId,
      req.requestId
    );

    res.status(201).json({
      id: membership.id,
      buildingId: membership.buildingId,
      unitId: membership.unitId,
      userId: membership.userId,
      status: membership.status,
      roleInBuilding: membership.roleInBuilding,
      createdAt: membership.createdAt,
      verifiedAt: membership.verifiedAt,
    });
  })
);

// GET /buildings/:buildingId/me - Get my membership status
router.get(
  '/:buildingId/me',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest & RequestWithId, res: Response) => {
    const { buildingId } = req.params;
    const userId = req.user!.userId;

    // Validate buildingId param
    const paramResult = buildingIdParamSchema.safeParse({ buildingId });
    if (!paramResult.success) {
      const error = new Error('Invalid building ID format');
      (error as any).statusCode = 400;
      (error as any).code = 'VALIDATION_ERROR';
      throw error;
    }

    const membership = await getMyMembership(buildingId, userId);

    if (!membership) {
      res.status(404).json({
        error: {
          message: 'Membership not found',
          code: 'NOT_FOUND',
          statusCode: 404,
        },
      });
      return;
    }

    res.json({
      id: membership.id,
      buildingId: membership.buildingId,
      unitId: membership.unitId,
      userId: membership.userId,
      status: membership.status,
      roleInBuilding: membership.roleInBuilding,
      createdAt: membership.createdAt,
      verifiedAt: membership.verifiedAt,
    });
  })
);

// GET /buildings/:buildingId/memberships/pending - Get pending memberships (admin only)
router.get(
  '/:buildingId/memberships/pending',
  authenticate,
  requireBuildingAdmin(),
  asyncHandler(async (req: AuthenticatedRequest & RequestWithId, res: Response) => {
    const { buildingId } = req.params;

    // Validate buildingId param
    const paramResult = buildingIdParamSchema.safeParse({ buildingId });
    if (!paramResult.success) {
      const error = new Error('Invalid building ID format');
      (error as any).statusCode = 400;
      (error as any).code = 'VALIDATION_ERROR';
      throw error;
    }

    const pendingMemberships = await getPendingMemberships(buildingId);

    res.json({
      memberships: pendingMemberships.map((membership) => ({
        id: membership.id,
        buildingId: membership.buildingId,
        unitId: membership.unitId,
        userId: membership.userId,
        status: membership.status,
        roleInBuilding: membership.roleInBuilding,
        createdAt: membership.createdAt,
        verifiedAt: membership.verifiedAt,
      })),
    });
  })
);

// PATCH /buildings/:buildingId/memberships/:membershipId/verify - Verify a pending membership (admin only)
router.patch(
  '/:buildingId/memberships/:membershipId/verify',
  authenticate,
  requireBuildingAdmin(),
  asyncHandler(async (req: AuthenticatedRequest & RequestWithId, res: Response) => {
    const { buildingId, membershipId } = req.params;

    // Validate params
    const buildingParamResult = buildingIdParamSchema.safeParse({ buildingId });
    const membershipParamResult = membershipIdParamSchema.safeParse({ membershipId });
    
    if (!buildingParamResult.success || !membershipParamResult.success) {
      const error = new Error('Invalid building ID or membership ID format');
      (error as any).statusCode = 400;
      (error as any).code = 'VALIDATION_ERROR';
      throw error;
    }

    // Verify the membership belongs to the building
    const [membership] = await db
      .select()
      .from(memberships)
      .where(
        and(
          eq(memberships.id, membershipId),
          eq(memberships.buildingId, buildingId)
        )
      )
      .limit(1);

    if (!membership) {
      res.status(404).json({
        error: {
          message: 'Membership not found',
          code: 'NOT_FOUND',
          statusCode: 404,
        },
      });
      return;
    }

    const verifiedMembership = await verifyMembership(
      membershipId,
      req.requestId
    );

    res.json({
      id: verifiedMembership.id,
      buildingId: verifiedMembership.buildingId,
      unitId: verifiedMembership.unitId,
      userId: verifiedMembership.userId,
      status: verifiedMembership.status,
      roleInBuilding: verifiedMembership.roleInBuilding,
      createdAt: verifiedMembership.createdAt,
      verifiedAt: verifiedMembership.verifiedAt,
    });
  })
);

export default router;

