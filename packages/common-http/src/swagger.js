"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createOpenAPISpec = createOpenAPISpec;
/**
 * Creates a standardized OpenAPI 3.0 specification for a microservice
 * @param serviceName - Display name for the service (e.g., "IAM API")
 * @param prefix - URL prefix for the service (e.g., "/iam")
 * @param paths - OpenAPI paths definition
 * @returns Complete OpenAPI 3.0 specification
 */
function createOpenAPISpec(serviceName, prefix, paths) {
    return {
        openapi: '3.0.0',
        info: {
            title: serviceName,
            version: '1.0.0',
        },
        servers: [
            {
                url: prefix,
                description: 'API Gateway base path',
            },
        ],
        paths,
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                },
            },
        },
    };
}
//# sourceMappingURL=swagger.js.map