import { Router, Response } from 'express';
import { asyncHandler } from '@common/http';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import { getUserById } from '../services/auth.service';
import { ApiError } from '@common/http';

const router: Router = Router();

router.get(
  '/me',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      const error: ApiError = new Error('Unauthorized: User information not available');
      error.statusCode = 401;
      error.code = 'UNAUTHORIZED';
      throw error;
    }

    const user = await getUserById(req.user.userId);

    if (!user) {
      const error: ApiError = new Error('User not found');
      error.statusCode = 404;
      error.code = 'USER_NOT_FOUND';
      throw error;
    }

    res.json({
      id: user.id,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
    });
  })
);

export default router;

