export type OpenAPIPaths = {
    [path: string]: {
        [method: string]: Record<string, any>;
    };
};
export interface OpenAPISpec {
    openapi: string;
    info: {
        title: string;
        version: string;
    };
    servers: Array<{
        url: string;
        description?: string;
    }>;
    paths: OpenAPIPaths;
    components: {
        securitySchemes: {
            [schemeName: string]: {
                type: string;
                scheme?: string;
                bearerFormat?: string;
            };
        };
    };
}
/**
 * Creates a standardized OpenAPI 3.0 specification for a microservice
 * @param serviceName - Display name for the service (e.g., "IAM API")
 * @param prefix - URL prefix for the service (e.g., "/iam")
 * @param paths - OpenAPI paths definition
 * @returns Complete OpenAPI 3.0 specification
 */
export declare function createOpenAPISpec(serviceName: string, prefix: string, paths: OpenAPIPaths): OpenAPISpec;
//# sourceMappingURL=swagger.d.ts.map