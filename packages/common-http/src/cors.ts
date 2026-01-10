import cors, { CorsOptions } from 'cors';
import { Request, Response, NextFunction } from 'express';

export interface CorsConfig {
  origin?: string | string[] | ((origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => void);
  credentials?: boolean;
  methods?: string[];
  allowedHeaders?: string[];
  exposedHeaders?: string[];
  maxAge?: number;
}

/**
 * Create CORS middleware with configurable options
 * 
 * Default configuration:
 * - Allows all origins in development
 * - Allows specific origins in production (from CORS_ORIGIN env var)
 * - Supports credentials
 * - Allows common HTTP methods
 */
export function createCorsMiddleware(config?: CorsConfig) {
  const isDevelopment = process.env.NODE_ENV !== 'production';
  
  // Default origins: allow all in development, specific in production
  const defaultOrigin = isDevelopment 
    ? true // Allow all origins in development
    : process.env.CORS_ORIGIN 
      ? process.env.CORS_ORIGIN.split(',').map(origin => origin.trim())
      : false; // Deny all in production if not configured

  const corsOptions: CorsOptions = {
    origin: config?.origin ?? defaultOrigin,
    credentials: config?.credentials ?? true,
    methods: config?.methods ?? ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: config?.allowedHeaders ?? [
      'Content-Type',
      'Authorization',
      'X-Request-ID',
      'X-Correlation-ID',
    ],
    exposedHeaders: config?.exposedHeaders ?? [
      'X-Request-ID',
      'X-Correlation-ID',
    ],
    maxAge: config?.maxAge ?? 86400, // 24 hours
  };

  return cors(corsOptions);
}

/**
 * Simple CORS middleware that allows all origins (for development)
 */
export function corsAllowAll() {
  return cors({
    origin: true,
    credentials: true,
  });
}

