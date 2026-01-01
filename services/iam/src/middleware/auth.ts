import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../services/token.service';
import { ApiError } from '@common/http';

export interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    role: string;
  };
}

export function authenticate(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): void {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      const error: ApiError = new Error('Missing or invalid authorization header');
      error.statusCode = 401;
      error.code = 'UNAUTHORIZED';
      throw error;
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    const payload = verifyAccessToken(token);

    req.user = {
      userId: payload.userId,
      role: payload.role,
    };

    next();
  } catch (error) {
    if (error instanceof Error && error.message === 'Token expired') {
      const apiError: ApiError = new Error('Token expired');
      apiError.statusCode = 401;
      apiError.code = 'TOKEN_EXPIRED';
      next(apiError);
      return;
    }
    if (error instanceof Error && error.message === 'Invalid token') {
      const apiError: ApiError = new Error('Invalid token');
      apiError.statusCode = 401;
      apiError.code = 'INVALID_TOKEN';
      next(apiError);
      return;
    }
    next(error);
  }
}

