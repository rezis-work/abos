import { Router, Response } from 'express';
import {
  asyncHandler,
  validateQuery,
  RequestWithId,
} from '@common/http';
import { createLogger } from '@common/logger';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import {
  getNotificationsQuerySchema,
  notificationIdParamSchema,
} from './notifications.schemas';
import {
  getUserNotifications,
  getNotificationById,
  markNotificationAsRead,
} from '../services/notification.service';

const logger = createLogger('notifications-route');
const router: Router = Router();

// GET /notifications - List user's notifications
router.get(
  '/',
  authenticate,
  validateQuery(getNotificationsQuerySchema),
  asyncHandler(async (req: AuthenticatedRequest & RequestWithId, res: Response) => {
    const userId = req.user!.userId;
    const limit = Number(req.query.limit) || 50;
    const offset = Number(req.query.offset) || 0;

    logger.info('Fetching notifications', { 
      userId, 
      userRole: req.user!.role,
      limit, 
      offset 
    });

    const notifications = await getUserNotifications(userId, limit, offset);
    
    logger.info('Notifications fetched', { 
      userId, 
      userRole: req.user!.role,
      count: notifications.length,
      notificationUserIds: notifications.map(n => n.userId)
    });
    
    // If no notifications found, log a warning to help debug
    if (notifications.length === 0) {
      logger.warn('No notifications found for user', { 
        userId, 
        userRole: req.user!.role,
        message: 'Make sure you are querying with the correct userId. Notifications are user-scoped.'
      });
    }

    res.json({
      notifications: notifications.map((notification) => ({
        id: notification.id,
        userId: notification.userId,
        type: notification.type,
        title: notification.title,
        body: notification.body,
        data: notification.data,
        readAt: notification.readAt,
        createdAt: notification.createdAt,
      })),
      pagination: {
        limit,
        offset,
        total: notifications.length,
      },
    });
  })
);

// GET /notifications/:id - Get notification by ID
router.get(
  '/:id',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest & RequestWithId, res: Response) => {
    const { id } = req.params;
    const userId = req.user!.userId;

    // Validate notification ID param
    const paramResult = notificationIdParamSchema.safeParse({ id });
    if (!paramResult.success) {
      const error = new Error('Invalid notification ID format');
      (error as any).statusCode = 400;
      (error as any).code = 'VALIDATION_ERROR';
      throw error;
    }

    const notification = await getNotificationById(id, userId);

    if (!notification) {
      res.status(404).json({
        error: {
          message: 'Notification not found',
          code: 'NOT_FOUND',
          statusCode: 404,
        },
      });
      return;
    }

    res.json({
      id: notification.id,
      userId: notification.userId,
      type: notification.type,
      title: notification.title,
      body: notification.body,
      data: notification.data,
      readAt: notification.readAt,
      createdAt: notification.createdAt,
    });
  })
);

// PATCH /notifications/:id/read - Mark notification as read
router.patch(
  '/:id/read',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest & RequestWithId, res: Response) => {
    const { id } = req.params;
    const userId = req.user!.userId;

    // Validate notification ID param
    const paramResult = notificationIdParamSchema.safeParse({ id });
    if (!paramResult.success) {
      const error = new Error('Invalid notification ID format');
      (error as any).statusCode = 400;
      (error as any).code = 'VALIDATION_ERROR';
      throw error;
    }

    const notification = await markNotificationAsRead(id, userId);

    if (!notification) {
      res.status(404).json({
        error: {
          message: 'Notification not found',
          code: 'NOT_FOUND',
          statusCode: 404,
        },
      });
      return;
    }

    res.json({
      id: notification.id,
      userId: notification.userId,
      type: notification.type,
      title: notification.title,
      body: notification.body,
      data: notification.data,
      readAt: notification.readAt,
      createdAt: notification.createdAt,
    });
  })
);

export default router;

