"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemoryRateLimitStore = void 0;
exports.rateLimit = rateLimit;
class MemoryRateLimitStore {
    store = new Map();
    async get(key) {
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
    async set(key, value, ttlSeconds) {
        this.store.set(key, {
            count: value,
            expiresAt: Date.now() + ttlSeconds * 1000,
        });
    }
    async increment(key, ttlSeconds) {
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
exports.MemoryRateLimitStore = MemoryRateLimitStore;
function rateLimit(options) {
    const { windowMs, maxRequests, store = new MemoryRateLimitStore(), keyGenerator = (req) => `${req.ip}:${req.path}`, } = options;
    const windowSeconds = Math.ceil(windowMs / 1000);
    return async (req, res, next) => {
        const key = keyGenerator(req);
        const count = await store.increment(key, windowSeconds);
        // Set rate limit headers
        res.setHeader('X-RateLimit-Limit', maxRequests);
        res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - count));
        res.setHeader('X-RateLimit-Reset', new Date(Date.now() + windowMs).toISOString());
        if (count > maxRequests) {
            const apiError = new Error('Too many requests');
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
//# sourceMappingURL=rate-limit.js.map