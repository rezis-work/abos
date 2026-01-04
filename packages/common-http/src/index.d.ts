import express, { Request, Response, NextFunction, Express } from 'express';
import { ZodSchema } from 'zod';
import { Logger } from '@common/logger';
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
export declare function errorHandler(err: ApiError, req: RequestWithId, res: Response, _next: NextFunction): void;
export declare function correlationId(): (req: RequestWithId, res: Response, next: NextFunction) => void;
export declare function requestLogger(logger: Logger): (req: RequestWithId, res: Response, next: NextFunction) => void;
export declare function healthCheckRoute(serviceName: string): (_req: Request, res: Response) => void;
export declare function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>): (req: Request, res: Response, next: NextFunction) => void;
export declare function validateBody<T extends ZodSchema>(schema: T): (req: RequestWithId, _res: Response, next: NextFunction) => void;
export declare function validateQuery<T extends ZodSchema>(schema: T): (req: RequestWithId, _res: Response, next: NextFunction) => void;
export * from './rate-limit';
export * from './swagger';
export { express, Express, Request, Response, NextFunction };
//# sourceMappingURL=index.d.ts.map