"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.express = void 0;
exports.errorHandler = errorHandler;
exports.correlationId = correlationId;
exports.requestLogger = requestLogger;
exports.healthCheckRoute = healthCheckRoute;
exports.asyncHandler = asyncHandler;
exports.validateBody = validateBody;
exports.validateQuery = validateQuery;
const express_1 = __importDefault(require("express"));
exports.express = express_1.default;
const zod_1 = require("zod");
const uuid_1 = require("uuid");
function errorHandler(err, req, res, _next) {
    const statusCode = err.statusCode || 500;
    const message = err.message || 'Internal Server Error';
    const response = {
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
function correlationId() {
    return (req, res, next) => {
        // Accept incoming correlation ID or generate new one
        const incomingId = req.headers['x-request-id'] || req.headers['x-correlation-id'];
        req.requestId = incomingId || (0, uuid_1.v4)();
        // Set response header
        res.setHeader('x-request-id', req.requestId);
        next();
    };
}
function requestLogger(logger) {
    return (req, res, next) => {
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
function healthCheckRoute(serviceName) {
    return (_req, res) => {
        res.json({
            status: 'ok',
            service: serviceName,
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
        });
    };
}
function asyncHandler(fn) {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}
function validateBody(schema) {
    return (req, _res, next) => {
        try {
            req.body = schema.parse(req.body);
            next();
        }
        catch (error) {
            if (error instanceof zod_1.z.ZodError) {
                const apiError = new Error('Validation error');
                apiError.statusCode = 400;
                apiError.code = 'VALIDATION_ERROR';
                apiError.details = error.errors;
                next(apiError);
            }
            else {
                next(error);
            }
        }
    };
}
function validateQuery(schema) {
    return (req, _res, next) => {
        try {
            req.query = schema.parse(req.query);
            next();
        }
        catch (error) {
            if (error instanceof zod_1.z.ZodError) {
                const apiError = new Error('Query validation error');
                apiError.statusCode = 400;
                apiError.code = 'VALIDATION_ERROR';
                apiError.details = error.errors;
                next(apiError);
            }
            else {
                next(error);
            }
        }
    };
}
__exportStar(require("./rate-limit"), exports);
__exportStar(require("./swagger"), exports);
//# sourceMappingURL=index.js.map