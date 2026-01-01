import express, { Request, Response, NextFunction, Express } from 'express';
import { Logger } from '@common/logger';

export interface ApiError extends Error {
  statusCode?: number;
  code?: string;
}

export interface ErrorResponse {
  error: {
    message: string;
    code?: string;
    statusCode: number;
  };
  timestamp: string;
  path?: string;
}

export function errorHandler(
  err: ApiError,
  req: Request,
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
    },
    timestamp: new Date().toISOString(),
    path: req.path,
  };

  res.status(statusCode).json(response);
}

export function requestLogger(logger: Logger) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const start = Date.now();

    res.on('finish', () => {
      const duration = Date.now() - start;
      logger.info('HTTP request', {
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

export { express, Express, Request, Response, NextFunction };

