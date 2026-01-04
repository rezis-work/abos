import express, { Request, Response, NextFunction, Express } from 'express';
import { z, ZodSchema } from 'zod';
import { Logger } from '@common/logger';
import { v4 as uuidv4 } from 'uuid';

export interface ApiError extends Error {
  statusCode?: number;
  code?: string;
  details?: unknown;
}

export interface ErrorResponse {
  error: {
    message: string;
    code?: string;
    statusCode: number;
    details?: unknown;
  };
  requestId?: string;
  timestamp: string;
  path?: string;
}

export interface RequestWithId extends Request {
  requestId?: string;
}

export function errorHandler(
  err: ApiError,
  req: RequestWithId,
  res: Response,
  _next: NextFunction
): void {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  const response: ErrorResponse = {
    error: {
      message,
      code: err.code,
      statusCode,
      details: err.details,
    },
    requestId: req.requestId,
    timestamp: new Date().toISOString(),
    path: req.path,
  };

  res.status(statusCode).json(response);
}

export function correlationId() {
  return (req: RequestWithId, res: Response, next: NextFunction): void => {
    // Accept incoming correlation ID or generate new one
    const incomingId = req.headers['x-request-id'] || req.headers['x-correlation-id'];
    req.requestId = (incomingId as string) || uuidv4();
    
    // Set response header
    res.setHeader('x-request-id', req.requestId);
    
    next();
  };
}

export function requestLogger(logger: Logger) {
  return (req: RequestWithId, res: Response, next: NextFunction): void => {
    const start = Date.now();
    const requestLogger = logger.child({ requestId: req.requestId });

    res.on('finish', () => {
      const duration = Date.now() - start;
      requestLogger.info('HTTP request', {
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        duration: `${duration}ms`,
        ip: req.ip,
      });
    });

    next();
  };
}

export function healthCheckRoute(serviceName: string) {
  return (_req: Request, res: Response): void => {
    res.json({
      status: 'ok',
      service: serviceName,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  };
}

export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export function validateBody<T extends ZodSchema>(schema: T) {
  return (req: RequestWithId, _res: Response, next: NextFunction): void => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const apiError: ApiError = new Error('Validation error');
        apiError.statusCode = 400;
        apiError.code = 'VALIDATION_ERROR';
        apiError.details = error.errors;
        next(apiError);
      } else {
        next(error);
      }
    }
  };
}

export function validateQuery<T extends ZodSchema>(schema: T) {
  return (req: RequestWithId, _res: Response, next: NextFunction): void => {
    try {
      req.query = schema.parse(req.query) as any;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const apiError: ApiError = new Error('Query validation error');
        apiError.statusCode = 400;
        apiError.code = 'VALIDATION_ERROR';
        apiError.details = error.errors;
        next(apiError);
      } else {
        next(error);
      }
    }
  };
}

export * from './rate-limit';
export * from './swagger';
export { express, Express, Request, Response, NextFunction };

