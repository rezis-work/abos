import { Router, Response } from 'express';
import {
  asyncHandler,
  validateBody,
  validateQuery,
  RequestWithId,
} from '@common/http';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import {
  requireVerifiedResident,
  requireAdminOrGuard,
} from '../middleware/authorize';
import {
  buildingIdParamSchema,
  visitorPassIdParamSchema,
  createVisitorPassSchema,
  listVisitorPassesQuerySchema,
} from './visitor-passes.schemas';
import {
  createVisitorPass,
  getMyVisitorPasses,
  getVisitorPassById,
  revokeVisitorPass,
  markVisitorPassUsed,
} from '../services/visitor-pass.service';

const router: Router = Router();

// POST /buildings/:buildingId/visitor-passes - Create visitor pass (verified resident)
router.post(
  '/buildings/:buildingId/visitor-passes',
  authenticate,
  requireVerifiedResident(),
  validateBody(createVisitorPassSchema),
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

    const { visitorName, validFrom, validTo } = req.body;

    const pass = await createVisitorPass({
      buildingId,
      residentId: userId,
      visitorName,
      validFrom: new Date(validFrom),
      validTo: new Date(validTo),
      correlationId: req.requestId,
    });

    res.status(201).json({
      id: pass.id,
      buildingId: pass.buildingId,
      residentId: pass.residentId,
      visitorName: pass.visitorName,
      validFrom: pass.validFrom,
      validTo: pass.validTo,
      status: pass.status,
      createdAt: pass.createdAt,
    });
  })
);

// GET /buildings/:buildingId/my-visitor-passes - List my visitor passes (verified resident)
router.get(
  '/buildings/:buildingId/my-visitor-passes',
  authenticate,
  requireVerifiedResident(),
  validateQuery(listVisitorPassesQuerySchema),
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

    const limit = Number(req.query.limit) || 50;
    const offset = Number(req.query.offset) || 0;
    const status = req.query.status as 'active' | 'used' | 'revoked' | undefined;

    const passesList = await getMyVisitorPasses(
      buildingId,
      userId,
      {
        status,
        limit,
        offset,
      }
    );

    res.json({
      visitorPasses: passesList.map((pass) => ({
        id: pass.id,
        buildingId: pass.buildingId,
        residentId: pass.residentId,
        visitorName: pass.visitorName,
        validFrom: pass.validFrom,
        validTo: pass.validTo,
        status: pass.status,
        createdAt: pass.createdAt,
      })),
      pagination: {
        limit,
        offset,
        total: passesList.length,
      },
    });
  })
);

// PATCH /visitor-passes/:id/revoke - Revoke visitor pass (owner only)
router.patch(
  '/visitor-passes/:id/revoke',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest & RequestWithId, res: Response) => {
    const { id } = req.params;
    const userId = req.user!.userId;

    // Validate id param
    const paramResult = visitorPassIdParamSchema.safeParse({ id });
    if (!paramResult.success) {
      const error = new Error('Invalid visitor pass ID format');
      (error as any).statusCode = 400;
      (error as any).code = 'VALIDATION_ERROR';
      throw error;
    }

    const pass = await revokeVisitorPass(id, userId, req.requestId);

    res.json({
      id: pass.id,
      buildingId: pass.buildingId,
      residentId: pass.residentId,
      visitorName: pass.visitorName,
      validFrom: pass.validFrom,
      validTo: pass.validTo,
      status: pass.status,
      createdAt: pass.createdAt,
    });
  })
);

// PATCH /visitor-passes/:id/mark-used - Mark visitor pass as used (admin/guard only)
router.patch(
  '/visitor-passes/:id/mark-used',
  authenticate,
  requireAdminOrGuard(),
  asyncHandler(async (req: AuthenticatedRequest & RequestWithId, res: Response) => {
    const { id } = req.params;
    const userId = req.user!.userId;
    const userRole = req.user!.role;

    // Validate id param
    const paramResult = visitorPassIdParamSchema.safeParse({ id });
    if (!paramResult.success) {
      const error = new Error('Invalid visitor pass ID format');
      (error as any).statusCode = 400;
      (error as any).code = 'VALIDATION_ERROR';
      throw error;
    }

    // Get pass to determine buildingId
    const pass = await getVisitorPassById(id);
    if (!pass) {
      const error = new Error('Visitor pass not found');
      (error as any).statusCode = 404;
      (error as any).code = 'NOT_FOUND';
      throw error;
    }

    const updatedPass = await markVisitorPassUsed(
      id,
      userId,
      userRole,
      pass.buildingId,
      req.requestId
    );

    res.json({
      id: updatedPass.id,
      buildingId: updatedPass.buildingId,
      residentId: updatedPass.residentId,
      visitorName: updatedPass.visitorName,
      validFrom: updatedPass.validFrom,
      validTo: updatedPass.validTo,
      status: updatedPass.status,
      createdAt: updatedPass.createdAt,
    });
  })
);

export default router;

