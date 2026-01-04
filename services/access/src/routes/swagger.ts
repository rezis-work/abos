import { Router, Request, Response } from "express";
import swaggerUi from "swagger-ui-express";
import { createOpenAPISpec, OpenAPIPaths } from "@common/http";

const router: Router = Router();

// Common error response schema
const errorResponseSchema = {
  type: "object",
  properties: {
    error: {
      type: "object",
      properties: {
        message: { type: "string" },
        code: { type: "string" },
        statusCode: { type: "number" },
        details: { type: "object" },
      },
      required: ["message", "statusCode"],
    },
    requestId: { type: "string" },
    timestamp: { type: "string", format: "date-time" },
    path: { type: "string" },
  },
};

// Define OpenAPI paths
const paths: OpenAPIPaths = {
  "/health": {
    get: {
      summary: "Health check",
      description: "Returns the health status of the Access service",
      tags: ["Health"],
      responses: {
        "200": {
          description: "Service is healthy",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  status: { type: "string", example: "ok" },
                  service: { type: "string", example: "access-service" },
                  timestamp: { type: "string", format: "date-time" },
                  uptime: { type: "number", description: "Uptime in seconds" },
                },
              },
            },
          },
        },
      },
    },
  },
  "/buildings/{buildingId}/visitor-passes": {
    post: {
      summary: "Create visitor pass",
      description:
        "Create a new visitor pass for a building. Requires verified resident membership.",
      tags: ["Visitor Passes"],
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: "buildingId",
          in: "path",
          required: true,
          schema: {
            type: "string",
            format: "uuid",
          },
          description: "UUID of the building",
        },
      ],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["visitorName", "validFrom", "validTo"],
              properties: {
                visitorName: {
                  type: "string",
                  minLength: 1,
                  maxLength: 200,
                  example: "John Doe",
                },
                validFrom: {
                  type: "string",
                  format: "date-time",
                  example: "2024-01-15T10:00:00Z",
                },
                validTo: {
                  type: "string",
                  format: "date-time",
                  example: "2024-01-15T18:00:00Z",
                },
              },
            },
          },
        },
      },
      responses: {
        "201": {
          description: "Visitor pass created successfully",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  id: { type: "string", format: "uuid" },
                  buildingId: { type: "string", format: "uuid" },
                  residentId: { type: "string", format: "uuid" },
                  visitorName: { type: "string" },
                  validFrom: { type: "string", format: "date-time" },
                  validTo: { type: "string", format: "date-time" },
                  status: { type: "string", enum: ["active", "used", "revoked"] },
                  createdAt: { type: "string", format: "date-time" },
                },
              },
            },
          },
        },
        "400": {
          description: "Validation error",
          content: {
            "application/json": {
              schema: errorResponseSchema,
            },
          },
        },
        "401": {
          description: "Unauthorized - Invalid or missing token",
          content: {
            "application/json": {
              schema: errorResponseSchema,
            },
          },
        },
        "403": {
          description: "Forbidden - User is not a verified resident",
          content: {
            "application/json": {
              schema: errorResponseSchema,
            },
          },
        },
        "409": {
          description: "Conflict - Invalid date range",
          content: {
            "application/json": {
              schema: errorResponseSchema,
            },
          },
        },
      },
    },
    get: {
      summary: "List my visitor passes",
      description:
        "Get a list of visitor passes for the authenticated resident in a building. Requires verified resident membership.",
      tags: ["Visitor Passes"],
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: "buildingId",
          in: "path",
          required: true,
          schema: {
            type: "string",
            format: "uuid",
          },
          description: "UUID of the building",
        },
        {
          name: "status",
          in: "query",
          schema: {
            type: "string",
            enum: ["active", "used", "revoked"],
          },
          description: "Filter by status",
        },
        {
          name: "limit",
          in: "query",
          schema: {
            type: "integer",
            minimum: 1,
            maximum: 100,
            default: 50,
          },
          description: "Maximum number of passes to return",
        },
        {
          name: "offset",
          in: "query",
          schema: {
            type: "integer",
            minimum: 0,
            default: 0,
          },
          description: "Number of passes to skip",
        },
      ],
      responses: {
        "200": {
          description: "List of visitor passes",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  visitorPasses: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        id: { type: "string", format: "uuid" },
                        buildingId: { type: "string", format: "uuid" },
                        residentId: { type: "string", format: "uuid" },
                        visitorName: { type: "string" },
                        validFrom: { type: "string", format: "date-time" },
                        validTo: { type: "string", format: "date-time" },
                        status: { type: "string", enum: ["active", "used", "revoked"] },
                        createdAt: { type: "string", format: "date-time" },
                      },
                    },
                  },
                  pagination: {
                    type: "object",
                    properties: {
                      limit: { type: "integer" },
                      offset: { type: "integer" },
                      total: { type: "integer" },
                    },
                  },
                },
              },
            },
          },
        },
        "400": {
          description: "Invalid building ID format",
          content: {
            "application/json": {
              schema: errorResponseSchema,
            },
          },
        },
        "401": {
          description: "Unauthorized - Invalid or missing token",
          content: {
            "application/json": {
              schema: errorResponseSchema,
            },
          },
        },
        "403": {
          description: "Forbidden - User is not a verified resident",
          content: {
            "application/json": {
              schema: errorResponseSchema,
            },
          },
        },
      },
    },
  },
  "/visitor-passes/{id}/revoke": {
    patch: {
      summary: "Revoke visitor pass",
      description:
        "Revoke a visitor pass. Only the owner (residentId) can revoke, and only if status is 'active'.",
      tags: ["Visitor Passes"],
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: "id",
          in: "path",
          required: true,
          schema: {
            type: "string",
            format: "uuid",
          },
          description: "UUID of the visitor pass",
        },
      ],
      responses: {
        "200": {
          description: "Visitor pass revoked successfully",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  id: { type: "string", format: "uuid" },
                  buildingId: { type: "string", format: "uuid" },
                  residentId: { type: "string", format: "uuid" },
                  visitorName: { type: "string" },
                  validFrom: { type: "string", format: "date-time" },
                  validTo: { type: "string", format: "date-time" },
                  status: { type: "string", enum: ["active", "used", "revoked"] },
                  createdAt: { type: "string", format: "date-time" },
                },
              },
            },
          },
        },
        "400": {
          description: "Invalid visitor pass ID format or pass is not active",
          content: {
            "application/json": {
              schema: errorResponseSchema,
            },
          },
        },
        "401": {
          description: "Unauthorized - Invalid or missing token",
          content: {
            "application/json": {
              schema: errorResponseSchema,
            },
          },
        },
        "403": {
          description: "Forbidden - User does not own this visitor pass",
          content: {
            "application/json": {
              schema: errorResponseSchema,
            },
          },
        },
        "404": {
          description: "Visitor pass not found",
          content: {
            "application/json": {
              schema: errorResponseSchema,
            },
          },
        },
        "409": {
          description: "Conflict - Pass cannot be revoked (already used or revoked)",
          content: {
            "application/json": {
              schema: errorResponseSchema,
            },
          },
        },
      },
    },
  },
  "/visitor-passes/{id}/mark-used": {
    patch: {
      summary: "Mark visitor pass as used",
      description:
        "Mark a visitor pass as used. Only admin or guard can mark as used, and only if status is 'active' and within valid time window.",
      tags: ["Visitor Passes"],
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: "id",
          in: "path",
          required: true,
          schema: {
            type: "string",
            format: "uuid",
          },
          description: "UUID of the visitor pass",
        },
      ],
      responses: {
        "200": {
          description: "Visitor pass marked as used successfully",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  id: { type: "string", format: "uuid" },
                  buildingId: { type: "string", format: "uuid" },
                  residentId: { type: "string", format: "uuid" },
                  visitorName: { type: "string" },
                  validFrom: { type: "string", format: "date-time" },
                  validTo: { type: "string", format: "date-time" },
                  status: { type: "string", enum: ["active", "used", "revoked"] },
                  createdAt: { type: "string", format: "date-time" },
                },
              },
            },
          },
        },
        "400": {
          description: "Invalid visitor pass ID format or pass is not valid at this time",
          content: {
            "application/json": {
              schema: errorResponseSchema,
            },
          },
        },
        "401": {
          description: "Unauthorized - Invalid or missing token",
          content: {
            "application/json": {
              schema: errorResponseSchema,
            },
          },
        },
        "403": {
          description: "Forbidden - User is not an admin or guard",
          content: {
            "application/json": {
              schema: errorResponseSchema,
            },
          },
        },
        "404": {
          description: "Visitor pass not found",
          content: {
            "application/json": {
              schema: errorResponseSchema,
            },
          },
        },
        "409": {
          description: "Conflict - Pass cannot be marked as used (already used, revoked, or outside valid time window)",
          content: {
            "application/json": {
              schema: errorResponseSchema,
            },
          },
        },
      },
    },
  },
};

// Create OpenAPI spec
const openApiSpec = createOpenAPISpec("Access API", "/access", paths);

// Routes
router.get("/openapi.json", (_req: Request, res: Response) => {
  res.json(openApiSpec);
});

router.use("/docs", swaggerUi.serve);
router.get("/docs", swaggerUi.setup(openApiSpec));

export default router;
