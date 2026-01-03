import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { ApiError } from '@common/http';
import { getEnv } from '@common/env';
import { createLogger } from '@common/logger';

const env = getEnv();
const JWT_SECRET = (env.JWT_SECRET || 'change-me-in-production') as string;
const logger = createLogger('auth-middleware');

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
      logger.warn('Missing or invalid authorization header');
      const error: ApiError = new Error('Missing or invalid authorization header');
      error.statusCode = 401;
      error.code = 'UNAUTHORIZED';
      throw error;
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as {
        userId: string;
        role: string;
      };

      req.user = {
        userId: decoded.userId,
        role: decoded.role,
      };

      logger.debug('Token authenticated successfully', { userId: decoded.userId, role: decoded.role });
      next();
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        logger.warn('Token expired', { error: error.message });
        const apiError: ApiError = new Error('Token expired');
        apiError.statusCode = 401;
        apiError.code = 'TOKEN_EXPIRED';
        next(apiError);
        return;
      }
      if (error instanceof jwt.JsonWebTokenError) {
        logger.warn('Invalid token', { error: error.message, name: error.name });
        const apiError: ApiError = new Error('Invalid token');
        apiError.statusCode = 401;
        apiError.code = 'INVALID_TOKEN';
        next(apiError);
        return;
      }
      logger.error('Unexpected error during token verification', { error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  } catch (error) {
    next(error);
  }
}

