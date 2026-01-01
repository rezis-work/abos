import { Router, Response } from 'express';
import { asyncHandler, validateBody, RequestWithId } from '@common/http';
import { register, login, refresh, logout } from '../services/auth.service';
import { registerSchema, loginSchema, refreshSchema, logoutSchema } from './auth.schemas';
import { rateLimit } from '@common/http';

const router: Router = Router();

router.post(
  '/register',
  rateLimit({ windowMs: 15 * 60 * 1000, maxRequests: 5 }), // 5 requests per 15 minutes
  validateBody(registerSchema),
  asyncHandler(async (req: RequestWithId, res: Response) => {
    const { email, password, role } = req.body;
    const result = await register(email, password, role, req.requestId);

    res.status(201).json({
      user: {
        id: result.user.id,
        email: result.user.email,
        role: result.user.role,
        createdAt: result.user.createdAt,
      },
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    });
  })
);

router.post(
  '/login',
  rateLimit({ windowMs: 15 * 60 * 1000, maxRequests: 10 }), // 10 requests per 15 minutes
  validateBody(loginSchema),
  asyncHandler(async (req: RequestWithId, res: Response) => {
    const { email, password } = req.body;
    const result = await login(email, password);

    res.json({
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    });
  })
);

router.post(
  '/refresh',
  rateLimit({ windowMs: 60 * 1000, maxRequests: 20 }), // 20 requests per minute
  validateBody(refreshSchema),
  asyncHandler(async (req: RequestWithId, res: Response) => {
    const { refreshToken } = req.body;
    const result = await refresh(refreshToken);

    res.json({
      accessToken: result.accessToken,
    });
  })
);

router.post(
  '/logout',
  validateBody(logoutSchema),
  asyncHandler(async (req: RequestWithId, res: Response) => {
    const { refreshToken } = req.body;
    await logout(refreshToken);

    res.json({
      success: true,
    });
  })
);

export default router;

