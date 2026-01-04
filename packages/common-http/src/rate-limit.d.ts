import { Request, Response, NextFunction } from 'express';
export interface RateLimitStore {
    get(key: string): Promise<number | null>;
    set(key: string, value: number, ttlSeconds: number): Promise<void>;
    increment(key: string, ttlSeconds: number): Promise<number>;
}
export declare class MemoryRateLimitStore implements RateLimitStore {
    private store;
    get(key: string): Promise<number | null>;
    set(key: string, value: number, ttlSeconds: number): Promise<void>;
    increment(key: string, ttlSeconds: number): Promise<number>;
}
export interface RateLimitOptions {
    windowMs: number;
    maxRequests: number;
    store?: RateLimitStore;
    keyGenerator?: (req: Request) => string;
    skipSuccessfulRequests?: boolean;
    skipFailedRequests?: boolean;
}
export declare function rateLimit(options: RateLimitOptions): (req: Request, res: Response, next: NextFunction) => Promise<void>;
//# sourceMappingURL=rate-limit.d.ts.map