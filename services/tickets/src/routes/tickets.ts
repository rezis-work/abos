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
} from '../middleware/authorize';
import {
  buildingIdParamSchema,
  ticketIdParamSchema,
  createTicketSchema,
  listTicketsQuerySchema,
  assignTicketSchema,
  changeTicketStatusSchema,
} from './tickets.schemas';
import {
  createTicket,
  getTicketsByBuilding,
  getTicketById,
  assignTicket,
  changeTicketStatus,
} from '../services/ticket.service';
import { isBuildingAdmin } from '../services/projection.service';

const router: Router = Router();

// POST /buildings/:buildingId/tickets - Create ticket (verified resident)
router.post(
  '/buildings/:buildingId/tickets',
  authenticate,
  requireVerifiedResident(),
  validateBody(createTicketSchema),
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

    const { title, description, category, priority } = req.body;

    const ticket = await createTicket({
      buildingId,
      userId,
      title,
      description,
      category,
      priority,
      correlationId: req.requestId,
    });

    res.status(201).json({
      id: ticket.id,
      buildingId: ticket.buildingId,
      unitId: ticket.unitId,
      createdByUserId: ticket.createdByUserId,
      title: ticket.title,
      description: ticket.description,
      category: ticket.category,
      priority: ticket.priority,
      status: ticket.status,
      assignedToUserId: ticket.assignedToUserId,
      createdAt: ticket.createdAt,
      updatedAt: ticket.updatedAt,
    });
  })
);

// GET /buildings/:buildingId/tickets - List tickets (admin/resident)
router.get(
  '/buildings/:buildingId/tickets',
  authenticate,
  validateQuery(listTicketsQuerySchema),
  asyncHandler(async (req: AuthenticatedRequest & RequestWithId, res: Response) => {
    const { buildingId } = req.params;
    const userId = req.user!.userId;
    const userRole = req.user!.role;

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
    const status = req.query.status as 'open' | 'in_progress' | 'resolved' | 'closed' | undefined;

    const ticketsList = await getTicketsByBuilding(
      buildingId,
      userId,
      userRole,
      {
        status,
        limit,
        offset,
      }
    );

    res.json({
      tickets: ticketsList.map((ticket) => ({
        id: ticket.id,
        buildingId: ticket.buildingId,
        unitId: ticket.unitId,
        createdByUserId: ticket.createdByUserId,
        title: ticket.title,
        description: ticket.description,
        category: ticket.category,
        priority: ticket.priority,
        status: ticket.status,
        assignedToUserId: ticket.assignedToUserId,
        createdAt: ticket.createdAt,
        updatedAt: ticket.updatedAt,
      })),
      pagination: {
        limit,
        offset,
        total: ticketsList.length,
      },
    });
  })
);

// GET /tickets/:ticketId - Get ticket by ID
router.get(
  '/tickets/:ticketId',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest & RequestWithId, res: Response) => {
    const { ticketId } = req.params;
    const userId = req.user!.userId;
    const userRole = req.user!.role;

    // Validate ticketId param
    const paramResult = ticketIdParamSchema.safeParse({ ticketId });
    if (!paramResult.success) {
      const error = new Error('Invalid ticket ID format');
      (error as any).statusCode = 400;
      (error as any).code = 'VALIDATION_ERROR';
      throw error;
    }

    const ticket = await getTicketById(ticketId);

    if (!ticket) {
      res.status(404).json({
        error: {
          message: 'Ticket not found',
          code: 'NOT_FOUND',
          statusCode: 404,
        },
      });
      return;
    }

    // Check authorization: admin for building OR ticket creator
    const isAdmin = await isBuildingAdmin(userId, ticket.buildingId, userRole);
    const isCreator = ticket.createdByUserId === userId;

    if (!isAdmin && !isCreator) {
      res.status(403).json({
        error: {
          message: 'You do not have access to this ticket',
          code: 'FORBIDDEN',
          statusCode: 403,
        },
      });
      return;
    }

    res.json({
      id: ticket.id,
      buildingId: ticket.buildingId,
      unitId: ticket.unitId,
      createdByUserId: ticket.createdByUserId,
      title: ticket.title,
      description: ticket.description,
      category: ticket.category,
      priority: ticket.priority,
      status: ticket.status,
      assignedToUserId: ticket.assignedToUserId,
      createdAt: ticket.createdAt,
      updatedAt: ticket.updatedAt,
    });
  })
);

// PATCH /tickets/:ticketId/assign - Assign ticket (admin)
router.patch(
  '/tickets/:ticketId/assign',
  authenticate,
  validateBody(assignTicketSchema),
  asyncHandler(async (req: AuthenticatedRequest & RequestWithId, res: Response) => {
    const { ticketId } = req.params;
    const userId = req.user!.userId;
    const userRole = req.user!.role;

    // Validate ticketId param
    const paramResult = ticketIdParamSchema.safeParse({ ticketId });
    if (!paramResult.success) {
      const error = new Error('Invalid ticket ID format');
      (error as any).statusCode = 400;
      (error as any).code = 'VALIDATION_ERROR';
      throw error;
    }

    // Get ticket to check buildingId
    const ticket = await getTicketById(ticketId);
    if (!ticket) {
      res.status(404).json({
        error: {
          message: 'Ticket not found',
          code: 'NOT_FOUND',
          statusCode: 404,
        },
      });
      return;
    }

    // Check admin access
    const hasAccess = await isBuildingAdmin(userId, ticket.buildingId, userRole);
    if (!hasAccess) {
      res.status(403).json({
        error: {
          message: 'You do not have admin access to this building',
          code: 'FORBIDDEN',
          statusCode: 403,
        },
      });
      return;
    }

    const { assignedToUserId } = req.body;

    const updatedTicket = await assignTicket({
      ticketId,
      assignedToUserId,
      assignedByUserId: userId,
      correlationId: req.requestId,
    });

    res.json({
      id: updatedTicket.id,
      buildingId: updatedTicket.buildingId,
      unitId: updatedTicket.unitId,
      createdByUserId: updatedTicket.createdByUserId,
      title: updatedTicket.title,
      description: updatedTicket.description,
      category: updatedTicket.category,
      priority: updatedTicket.priority,
      status: updatedTicket.status,
      assignedToUserId: updatedTicket.assignedToUserId,
      createdAt: updatedTicket.createdAt,
      updatedAt: updatedTicket.updatedAt,
    });
  })
);

// PATCH /tickets/:ticketId/status - Change ticket status (admin)
router.patch(
  '/tickets/:ticketId/status',
  authenticate,
  validateBody(changeTicketStatusSchema),
  asyncHandler(async (req: AuthenticatedRequest & RequestWithId, res: Response) => {
    const { ticketId } = req.params;
    const userId = req.user!.userId;
    const userRole = req.user!.role;

    // Validate ticketId param
    const paramResult = ticketIdParamSchema.safeParse({ ticketId });
    if (!paramResult.success) {
      const error = new Error('Invalid ticket ID format');
      (error as any).statusCode = 400;
      (error as any).code = 'VALIDATION_ERROR';
      throw error;
    }

    // Get ticket to check buildingId
    const ticket = await getTicketById(ticketId);
    if (!ticket) {
      res.status(404).json({
        error: {
          message: 'Ticket not found',
          code: 'NOT_FOUND',
          statusCode: 404,
        },
      });
      return;
    }

    // Check admin access
    const hasAccess = await isBuildingAdmin(userId, ticket.buildingId, userRole);
    if (!hasAccess) {
      res.status(403).json({
        error: {
          message: 'You do not have admin access to this building',
          code: 'FORBIDDEN',
          statusCode: 403,
        },
      });
      return;
    }

    const { status } = req.body;

    const updatedTicket = await changeTicketStatus({
      ticketId,
      newStatus: status,
      changedByUserId: userId,
      correlationId: req.requestId,
    });

    res.json({
      id: updatedTicket.id,
      buildingId: updatedTicket.buildingId,
      unitId: updatedTicket.unitId,
      createdByUserId: updatedTicket.createdByUserId,
      title: updatedTicket.title,
      description: updatedTicket.description,
      category: updatedTicket.category,
      priority: updatedTicket.priority,
      status: updatedTicket.status,
      assignedToUserId: updatedTicket.assignedToUserId,
      createdAt: updatedTicket.createdAt,
      updatedAt: updatedTicket.updatedAt,
    });
  })
);

export default router;

