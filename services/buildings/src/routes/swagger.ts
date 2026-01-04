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
const paths = {
  "/health": {
    get: {
      summary: "Health check",
      description: "Returns the health status of the Buildings service",
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
                  service: { type: "string", example: "buildings-service" },
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
  "/": {
    get: {
      summary: "List all buildings",
      description:
        "Get a list of all buildings. Requires super_admin or manager role. Note: building_admin cannot list all buildings, only their own building.",
      tags: ["Buildings"],
      security: [{ bearerAuth: [] }],
      responses: {
        "200": {
          description: "List of buildings",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  buildings: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        id: { type: "string", format: "uuid" },
                        name: { type: "string" },
                        address: { type: "string" },
                        createdAt: { type: "string", format: "date-time" },
                      },
                    },
                  },
                },
              },
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
          description: "Forbidden - Insufficient permissions",
          content: {
            "application/json": {
              schema: errorResponseSchema,
            },
          },
        },
      },
    },
    post: {
      summary: "Create building",
      description:
        "Create a new building. Requires super_admin or manager role.",
      tags: ["Buildings"],
      security: [{ bearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["name", "address"],
              properties: {
                name: {
                  type: "string",
                  minLength: 1,
                  maxLength: 255,
                  example: "Sunset Apartments",
                },
                address: {
                  type: "string",
                  minLength: 1,
                  maxLength: 500,
                  example: "123 Main St, City, State 12345",
                },
              },
            },
          },
        },
      },
      responses: {
        "201": {
          description: "Building created successfully",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  id: { type: "string", format: "uuid" },
                  name: { type: "string" },
                  address: { type: "string" },
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
          description: "Forbidden - Insufficient permissions",
          content: {
            "application/json": {
              schema: errorResponseSchema,
            },
          },
        },
      },
    },
  },
  "/{buildingId}": {
    get: {
      summary: "Get building by ID",
      description: "Get details of a specific building by its ID",
      tags: ["Buildings"],
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
      responses: {
        "200": {
          description: "Building details",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  id: { type: "string", format: "uuid" },
                  name: { type: "string" },
                  address: { type: "string" },
                  createdAt: { type: "string", format: "date-time" },
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
        "404": {
          description: "Building not found",
          content: {
            "application/json": {
              schema: errorResponseSchema,
            },
          },
        },
      },
    },
  },
  "/{buildingId}/units": {
    get: {
      summary: "List units for a building",
      description:
        "Get all units for a specific building. Requires building_admin role.",
      tags: ["Units"],
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
      responses: {
        "200": {
          description: "List of units",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  units: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        id: { type: "string", format: "uuid" },
                        buildingId: { type: "string", format: "uuid" },
                        unitNumber: { type: "string" },
                        floor: { type: "number", nullable: true },
                        createdAt: { type: "string", format: "date-time" },
                      },
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
          description: "Forbidden - Insufficient permissions",
          content: {
            "application/json": {
              schema: errorResponseSchema,
            },
          },
        },
      },
    },
    post: {
      summary: "Bulk create units",
      description:
        "Create multiple units for a building in a single request. Requires building_admin, super_admin, or manager role.",
      tags: ["Units"],
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
              required: ["units"],
              properties: {
                units: {
                  type: "array",
                  minItems: 1,
                  items: {
                    type: "object",
                    required: ["unitNumber"],
                    properties: {
                      unitNumber: {
                        type: "string",
                        minLength: 1,
                        maxLength: 50,
                        example: "101",
                      },
                      floor: {
                        type: "number",
                        nullable: true,
                        example: 1,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      responses: {
        "201": {
          description: "Units created successfully",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  units: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        id: { type: "string", format: "uuid" },
                        buildingId: { type: "string", format: "uuid" },
                        unitNumber: { type: "string" },
                        floor: { type: "number", nullable: true },
                        createdAt: { type: "string", format: "date-time" },
                      },
                    },
                  },
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
          description: "Forbidden - Insufficient permissions",
          content: {
            "application/json": {
              schema: errorResponseSchema,
            },
          },
        },
      },
    },
  },
  "/{buildingId}/memberships": {
    post: {
      summary: "Assign user to unit",
      description:
        "Create a membership assigning a user to a unit in a building. Requires building_admin, super_admin, or manager role.",
      tags: ["Memberships"],
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
              required: ["unitId", "userId", "status", "roleInBuilding"],
              properties: {
                unitId: {
                  type: "string",
                  format: "uuid",
                  example: "123e4567-e89b-12d3-a456-426614174000",
                },
                userId: {
                  type: "string",
                  format: "uuid",
                  example: "123e4567-e89b-12d3-a456-426614174001",
                },
                status: {
                  type: "string",
                  enum: ["pending", "verified", "rejected"],
                  example: "verified",
                },
                roleInBuilding: {
                  type: "string",
                  enum: ["resident", "admin"],
                  example: "resident",
                },
              },
            },
          },
        },
      },
      responses: {
        "201": {
          description: "Membership created successfully",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  id: { type: "string", format: "uuid" },
                  buildingId: { type: "string", format: "uuid" },
                  unitId: { type: "string", format: "uuid" },
                  userId: { type: "string", format: "uuid" },
                  status: {
                    type: "string",
                    enum: ["pending", "verified", "rejected"],
                  },
                  roleInBuilding: {
                    type: "string",
                    enum: ["resident", "admin"],
                  },
                  createdAt: { type: "string", format: "date-time" },
                  verifiedAt: {
                    type: "string",
                    format: "date-time",
                    nullable: true,
                  },
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
          description: "Forbidden - Insufficient permissions",
          content: {
            "application/json": {
              schema: errorResponseSchema,
            },
          },
        },
      },
    },
  },
  "/{buildingId}/memberships/pending": {
    get: {
      summary: "Get pending memberships",
      description:
        "Get all pending membership requests for a building. Requires building_admin role.",
      tags: ["Memberships"],
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
      responses: {
        "200": {
          description: "List of pending memberships",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  memberships: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        id: { type: "string", format: "uuid" },
                        buildingId: { type: "string", format: "uuid" },
                        unitId: { type: "string", format: "uuid" },
                        userId: { type: "string", format: "uuid" },
                        status: {
                          type: "string",
                          enum: ["pending", "verified", "rejected"],
                        },
                        roleInBuilding: {
                          type: "string",
                          enum: ["resident", "admin"],
                        },
                        createdAt: { type: "string", format: "date-time" },
                        verifiedAt: {
                          type: "string",
                          format: "date-time",
                          nullable: true,
                        },
                      },
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
          description: "Forbidden - Insufficient permissions",
          content: {
            "application/json": {
              schema: errorResponseSchema,
            },
          },
        },
      },
    },
  },
  "/{buildingId}/memberships/{membershipId}/verify": {
    patch: {
      summary: "Verify pending membership",
      description:
        "Verify a pending membership request, changing its status from pending to verified. Requires building_admin role.",
      tags: ["Memberships"],
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
          name: "membershipId",
          in: "path",
          required: true,
          schema: {
            type: "string",
            format: "uuid",
          },
          description: "UUID of the membership",
        },
      ],
      responses: {
        "200": {
          description: "Membership verified successfully",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  id: { type: "string", format: "uuid" },
                  buildingId: { type: "string", format: "uuid" },
                  unitId: { type: "string", format: "uuid" },
                  userId: { type: "string", format: "uuid" },
                  status: {
                    type: "string",
                    enum: ["pending", "verified", "rejected"],
                  },
                  roleInBuilding: {
                    type: "string",
                    enum: ["resident", "admin"],
                  },
                  createdAt: { type: "string", format: "date-time" },
                  verifiedAt: {
                    type: "string",
                    format: "date-time",
                    nullable: true,
                  },
                },
              },
            },
          },
        },
        "400": {
          description: "Invalid building ID or membership ID format",
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
          description: "Forbidden - Insufficient permissions",
          content: {
            "application/json": {
              schema: errorResponseSchema,
            },
          },
        },
        "404": {
          description: "Membership not found",
          content: {
            "application/json": {
              schema: errorResponseSchema,
            },
          },
        },
      },
    },
  },
  "/{buildingId}/request-access": {
    post: {
      summary: "Request access to building",
      description:
        "Request access to a building by creating a pending membership. The user making the request will be assigned to the specified unit.",
      tags: ["Memberships"],
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
              required: ["unitId"],
              properties: {
                unitId: {
                  type: "string",
                  format: "uuid",
                  example: "123e4567-e89b-12d3-a456-426614174000",
                },
              },
            },
          },
        },
      },
      responses: {
        "201": {
          description: "Access request created successfully",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  id: { type: "string", format: "uuid" },
                  buildingId: { type: "string", format: "uuid" },
                  unitId: { type: "string", format: "uuid" },
                  userId: { type: "string", format: "uuid" },
                  status: {
                    type: "string",
                    enum: ["pending", "verified", "rejected"],
                  },
                  roleInBuilding: {
                    type: "string",
                    enum: ["resident", "admin"],
                  },
                  createdAt: { type: "string", format: "date-time" },
                  verifiedAt: {
                    type: "string",
                    format: "date-time",
                    nullable: true,
                  },
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
      },
    },
  },
  "/{buildingId}/me": {
    get: {
      summary: "Get my membership status",
      description:
        "Get the current user's membership status for a specific building",
      tags: ["Memberships"],
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
      responses: {
        "200": {
          description: "Membership details",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  id: { type: "string", format: "uuid" },
                  buildingId: { type: "string", format: "uuid" },
                  unitId: { type: "string", format: "uuid" },
                  userId: { type: "string", format: "uuid" },
                  status: {
                    type: "string",
                    enum: ["pending", "verified", "rejected"],
                  },
                  roleInBuilding: {
                    type: "string",
                    enum: ["resident", "admin"],
                  },
                  createdAt: { type: "string", format: "date-time" },
                  verifiedAt: {
                    type: "string",
                    format: "date-time",
                    nullable: true,
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
        "404": {
          description: "Membership not found",
          content: {
            "application/json": {
              schema: errorResponseSchema,
            },
          },
        },
      },
    },
  },
} as OpenAPIPaths;

// Generate OpenAPI spec
const openApiSpec = createOpenAPISpec("Buildings API", "/buildings", paths);

// Serve OpenAPI JSON
router.get("/openapi.json", (_req: Request, res: Response) => {
  res.json(openApiSpec);
});

// Serve Swagger UI
router.use("/docs", swaggerUi.serve);
router.get(
  "/docs",
  swaggerUi.setup(openApiSpec, {
    customCss: ".swagger-ui .topbar { display: none }",
    customSiteTitle: "Buildings API Documentation",
  })
);

export default router;
