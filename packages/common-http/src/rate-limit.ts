import { Request, Response, NextFunction } from 'express';
import { ApiError } from './index';

export interface RateLimitStore {
  get(key: string): Promise<number | null>;
  set(key: string, value: number, ttlSeconds: number): Promise<void>;
  increment(key: string, ttlSeconds: number): Promise<number>;
}

export class MemoryRateLimitStore implements RateLimitStore {
  private store: Map<string, { count: number; expiresAt: number }> = new Map();

  async get(key: string): Promise<number | null> {
    const entry = this.store.get(key);
    if (!entry) {
      return null;
    }
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.count;
  }

  async set(key: string, value: number, ttlSeconds: number): Promise<void> {
    this.store.set(key, {
      count: value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  async increment(key: string, ttlSeconds: number): Promise<number> {
    const entry = this.store.get(key);
    const now = Date.now();

    if (!entry || now > entry.expiresAt) {
      this.store.set(key, {
        count: 1,
        expiresAt: now + ttlSeconds * 1000,
      });
      return 1;
    }

    entry.count += 1;
    return entry.count;
  }
}

export interface RateLimitOptions {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Max requests per window
  store?: RateLimitStore;
  keyGenerator?: (req: Request) => string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

export function rateLimit(options: RateLimitOptions) {
  const {
    windowMs,
    maxRequests,
    store = new MemoryRateLimitStore(),
    keyGenerator = (req) => `${req.ip}:${req.path}`,
  } = options;

  const windowSeconds = Math.ceil(windowMs / 1000);

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const key = keyGenerator(req);
    const count = await store.increment(key, windowSeconds);

    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - count));
    res.setHeader('X-RateLimit-Reset', new Date(Date.now() + windowMs).toISOString());

    if (count > maxRequests) {
      const apiError: ApiError = new Error('Too many requests');
      apiError.statusCode = 429;
      apiError.code = 'RATE_LIMIT_EXCEEDED';
      next(apiError);
      return;
    }

    // Note: skipSuccessfulRequests and skipFailedRequests are not implemented
    // to avoid complex Response.end() override typing issues
    // For production, consider using a Redis-backed store with proper middleware

    next();
  };
}

