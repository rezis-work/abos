"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getEnv = getEnv;
exports.validateEnv = validateEnv;
const zod_1 = require("zod");
const envSchema = zod_1.z.object({
    // Application
    NODE_ENV: zod_1.z.enum(['development', 'production', 'test']).default('development'),
    LOG_LEVEL: zod_1.z.enum(['error', 'warn', 'info', 'debug']).default('info'),
    PORT: zod_1.z.string().transform(Number).pipe(zod_1.z.number().int().positive()).optional(),
    // Database
    DATABASE_URL: zod_1.z.string().url().optional(),
    POSTGRES_HOST: zod_1.z.string().default('localhost'),
    POSTGRES_PORT: zod_1.z.string().transform(Number).pipe(zod_1.z.number().int().positive()).default('5432'),
    POSTGRES_USER: zod_1.z.string().default('postgres'),
    POSTGRES_PASSWORD: zod_1.z.string().default('postgres'),
    POSTGRES_DB: zod_1.z.string().optional(),
    // RabbitMQ
    RABBITMQ_URL: zod_1.z.string().url().optional(),
    RABBITMQ_HOST: zod_1.z.string().default('localhost'),
    RABBITMQ_PORT: zod_1.z.string().transform(Number).pipe(zod_1.z.number().int().positive()).default('5672'),
    RABBITMQ_USER: zod_1.z.string().default('guest'),
    RABBITMQ_PASSWORD: zod_1.z.string().default('guest'),
    // Redis
    REDIS_URL: zod_1.z.string().url().optional(),
    REDIS_HOST: zod_1.z.string().default('localhost'),
    REDIS_PORT: zod_1.z.string().transform(Number).pipe(zod_1.z.number().int().positive()).default('6379'),
    REDIS_PASSWORD: zod_1.z.string().optional(),
    // Service-specific
    SERVICE_NAME: zod_1.z.string().optional(),
    // JWT Configuration (for IAM service)
    JWT_SECRET: zod_1.z.string().min(32).optional(),
    JWT_ACCESS_TOKEN_EXPIRY: zod_1.z.string().default('15m').optional(),
    REFRESH_TOKEN_EXPIRY: zod_1.z.string().default('7d').optional(),
});
let validatedEnv = null;
function getEnv() {
    if (validatedEnv) {
        return validatedEnv;
    }
    try {
        validatedEnv = envSchema.parse(process.env);
        return validatedEnv;
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            const missingVars = error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('\n');
            throw new Error(`Invalid environment variables:\n${missingVars}`);
        }
        throw error;
    }
}
function validateEnv() {
    getEnv();
}
//# sourceMappingURL=index.js.map