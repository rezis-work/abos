import { Router, Request, Response } from 'express';
import swaggerUi from 'swagger-ui-express';
import { createOpenAPISpec, OpenAPIPaths } from '@common/http';

const router: Router = Router();

// Common error response schema
const errorResponseSchema = {
  type: 'object',
  properties: {
    error: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        code: { type: 'string' },
        statusCode: { type: 'number' },
        details: { type: 'object' },
      },
      required: ['message', 'statusCode'],
    },
    requestId: { type: 'string' },
    timestamp: { type: 'string', format: 'date-time' },
    path: { type: 'string' },
  },
};

// Define OpenAPI paths
const paths = {
  '/health': {
    get: {
      summary: 'Health check',
      description: 'Returns the health status of the Tickets service',
      tags: ['Health'],
      responses: {
        '200': {
          description: 'Service is healthy',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  status: { type: 'string', example: 'ok' },
                  service: { type: 'string', example: 'tickets-service' },
                  timestamp: { type: 'string', format: 'date-time' },
                  uptime: { type: 'number', description: 'Uptime in seconds' },
                },
              },
            },
          },
        },
      },
    },
  },
  '/buildings/{buildingId}/tickets': {
    post: {
      summary: 'Create ticket',
      description: 'Create a new ticket for a building. Requires verified resident status.',
      tags: ['Tickets'],
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: 'buildingId',
          in: 'path',
          required: true,
          schema: {
            type: 'string',
            format: 'uuid',
          },
          description: 'UUID of the building',
        },
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['title', 'description', 'category', 'priority'],
              properties: {
                title: {
                  type: 'string',
                  minLength: 1,
                  maxLength: 255,
                  example: 'Leaky faucet in unit 101',
                },
                description: {
                  type: 'string',
                  minLength: 1,
                  example: 'The faucet in the kitchen is leaking water continuously',
                },
                category: {
                  type: 'string',
                  enum: ['maintenance', 'repair', 'complaint', 'other'],
                  example: 'repair',
                },
                priority: {
                  type: 'string',
                  enum: ['low', 'medium', 'high', 'urgent'],
                  example: 'medium',
                },
              },
            },
          },
        },
      },
      responses: {
        '201': {
          description: 'Ticket created successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  id: { type: 'string', format: 'uuid' },
                  buildingId: { type: 'string', format: 'uuid' },
                  unitId: { type: 'string', format: 'uuid', nullable: true },
                  createdByUserId: { type: 'string', format: 'uuid' },
                  title: { type: 'string' },
                  description: { type: 'string' },
                  category: { type: 'string', enum: ['maintenance', 'repair', 'complaint', 'other'] },
                  priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'] },
                  status: { type: 'string', enum: ['open', 'in_progress', 'resolved', 'closed'] },
                  assignedToUserId: { type: 'string', format: 'uuid', nullable: true },
                  createdAt: { type: 'string', format: 'date-time' },
                  updatedAt: { type: 'string', format: 'date-time' },
                },
              },
            },
          },
        },
        '400': {
          description: 'Validation error',
          content: {
            'application/json': {
              schema: errorResponseSchema,
            },
          },
        },
        '401': {
          description: 'Unauthorized - Invalid or missing token',
          content: {
            'application/json': {
              schema: errorResponseSchema,
            },
          },
        },
        '403': {
          description: 'Forbidden - User is not a verified resident',
          content: {
            'application/json': {
              schema: errorResponseSchema,
            },
          },
        },
      },
    },
    get: {
      summary: 'List tickets for a building',
      description: 'Get paginated list of tickets for a building. Admins see all tickets, residents see only their own tickets.',
      tags: ['Tickets'],
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: 'buildingId',
          in: 'path',
          required: true,
          schema: {
            type: 'string',
            format: 'uuid',
          },
          description: 'UUID of the building',
        },
        {
          name: 'limit',
          in: 'query',
          schema: {
            type: 'integer',
            minimum: 1,
            maximum: 100,
            default: 50,
          },
          description: 'Maximum number of tickets to return',
        },
        {
          name: 'offset',
          in: 'query',
          schema: {
            type: 'integer',
            minimum: 0,
            default: 0,
          },
          description: 'Number of tickets to skip',
        },
        {
          name: 'status',
          in: 'query',
          schema: {
            type: 'string',
            enum: ['open', 'in_progress', 'resolved', 'closed'],
          },
          description: 'Filter tickets by status',
        },
      ],
      responses: {
        '200': {
          description: 'List of tickets',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  tickets: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        id: { type: 'string', format: 'uuid' },
                        buildingId: { type: 'string', format: 'uuid' },
                        unitId: { type: 'string', format: 'uuid', nullable: true },
                        createdByUserId: { type: 'string', format: 'uuid' },
                        title: { type: 'string' },
                        description: { type: 'string' },
                        category: { type: 'string', enum: ['maintenance', 'repair', 'complaint', 'other'] },
                        priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'] },
                        status: { type: 'string', enum: ['open', 'in_progress', 'resolved', 'closed'] },
                        assignedToUserId: { type: 'string', format: 'uuid', nullable: true },
                        createdAt: { type: 'string', format: 'date-time' },
                        updatedAt: { type: 'string', format: 'date-time' },
                      },
                    },
                  },
                  pagination: {
                    type: 'object',
                    properties: {
                      limit: { type: 'number' },
                      offset: { type: 'number' },
                      total: { type: 'number' },
                    },
                  },
                },
              },
            },
          },
        },
        '400': {
          description: 'Validation error',
          content: {
            'application/json': {
              schema: errorResponseSchema,
            },
          },
        },
        '401': {
          description: 'Unauthorized - Invalid or missing token',
          content: {
            'application/json': {
              schema: errorResponseSchema,
            },
          },
        },
      },
    },
  },
  '/tickets/{ticketId}': {
    get: {
      summary: 'Get ticket by ID',
      description: 'Get a specific ticket by its ID. Admins can access any ticket in their building, residents can only access tickets they created.',
      tags: ['Tickets'],
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: 'ticketId',
          in: 'path',
          required: true,
          schema: {
            type: 'string',
            format: 'uuid',
          },
          description: 'UUID of the ticket',
        },
      ],
      responses: {
        '200': {
          description: 'Ticket details',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  id: { type: 'string', format: 'uuid' },
                  buildingId: { type: 'string', format: 'uuid' },
                  unitId: { type: 'string', format: 'uuid', nullable: true },
                  createdByUserId: { type: 'string', format: 'uuid' },
                  title: { type: 'string' },
                  description: { type: 'string' },
                  category: { type: 'string', enum: ['maintenance', 'repair', 'complaint', 'other'] },
                  priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'] },
                  status: { type: 'string', enum: ['open', 'in_progress', 'resolved', 'closed'] },
                  assignedToUserId: { type: 'string', format: 'uuid', nullable: true },
                  createdAt: { type: 'string', format: 'date-time' },
                  updatedAt: { type: 'string', format: 'date-time' },
                },
              },
            },
          },
        },
        '400': {
          description: 'Invalid ticket ID format',
          content: {
            'application/json': {
              schema: errorResponseSchema,
            },
          },
        },
        '401': {
          description: 'Unauthorized - Invalid or missing token',
          content: {
            'application/json': {
              schema: errorResponseSchema,
            },
          },
        },
        '403': {
          description: 'Forbidden - Insufficient permissions to access this ticket',
          content: {
            'application/json': {
              schema: errorResponseSchema,
            },
          },
        },
        '404': {
          description: 'Ticket not found',
          content: {
            'application/json': {
              schema: errorResponseSchema,
            },
          },
        },
      },
    },
  },
  '/tickets/{ticketId}/assign': {
    patch: {
      summary: 'Assign ticket',
      description: 'Assign a ticket to a user. Requires building admin role.',
      tags: ['Tickets'],
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: 'ticketId',
          in: 'path',
          required: true,
          schema: {
            type: 'string',
            format: 'uuid',
          },
          description: 'UUID of the ticket',
        },
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['assignedToUserId'],
              properties: {
                assignedToUserId: {
                  type: 'string',
                  format: 'uuid',
                  example: '123e4567-e89b-12d3-a456-426614174000',
                },
              },
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Ticket assigned successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  id: { type: 'string', format: 'uuid' },
                  buildingId: { type: 'string', format: 'uuid' },
                  unitId: { type: 'string', format: 'uuid', nullable: true },
                  createdByUserId: { type: 'string', format: 'uuid' },
                  title: { type: 'string' },
                  description: { type: 'string' },
                  category: { type: 'string', enum: ['maintenance', 'repair', 'complaint', 'other'] },
                  priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'] },
                  status: { type: 'string', enum: ['open', 'in_progress', 'resolved', 'closed'] },
                  assignedToUserId: { type: 'string', format: 'uuid', nullable: true },
                  createdAt: { type: 'string', format: 'date-time' },
                  updatedAt: { type: 'string', format: 'date-time' },
                },
              },
            },
          },
        },
        '400': {
          description: 'Validation error',
          content: {
            'application/json': {
              schema: errorResponseSchema,
            },
          },
        },
        '401': {
          description: 'Unauthorized - Invalid or missing token',
          content: {
            'application/json': {
              schema: errorResponseSchema,
            },
          },
        },
        '403': {
          description: 'Forbidden - Insufficient permissions',
          content: {
            'application/json': {
              schema: errorResponseSchema,
            },
          },
        },
        '404': {
          description: 'Ticket not found',
          content: {
            'application/json': {
              schema: errorResponseSchema,
            },
          },
        },
      },
    },
  },
  '/tickets/{ticketId}/status': {
    patch: {
      summary: 'Change ticket status',
      description: 'Update the status of a ticket. Requires building admin role.',
      tags: ['Tickets'],
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: 'ticketId',
          in: 'path',
          required: true,
          schema: {
            type: 'string',
            format: 'uuid',
          },
          description: 'UUID of the ticket',
        },
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['status'],
              properties: {
                status: {
                  type: 'string',
                  enum: ['open', 'in_progress', 'resolved', 'closed'],
                  example: 'in_progress',
                },
              },
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Ticket status updated successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  id: { type: 'string', format: 'uuid' },
                  buildingId: { type: 'string', format: 'uuid' },
                  unitId: { type: 'string', format: 'uuid', nullable: true },
                  createdByUserId: { type: 'string', format: 'uuid' },
                  title: { type: 'string' },
                  description: { type: 'string' },
                  category: { type: 'string', enum: ['maintenance', 'repair', 'complaint', 'other'] },
                  priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'] },
                  status: { type: 'string', enum: ['open', 'in_progress', 'resolved', 'closed'] },
                  assignedToUserId: { type: 'string', format: 'uuid', nullable: true },
                  createdAt: { type: 'string', format: 'date-time' },
                  updatedAt: { type: 'string', format: 'date-time' },
                },
              },
            },
          },
        },
        '400': {
          description: 'Validation error',
          content: {
            'application/json': {
              schema: errorResponseSchema,
            },
          },
        },
        '401': {
          description: 'Unauthorized - Invalid or missing token',
          content: {
            'application/json': {
              schema: errorResponseSchema,
            },
          },
        },
        '403': {
          description: 'Forbidden - Insufficient permissions',
          content: {
            'application/json': {
              schema: errorResponseSchema,
            },
          },
        },
        '404': {
          description: 'Ticket not found',
          content: {
            'application/json': {
              schema: errorResponseSchema,
            },
          },
        },
      },
    },
  },
} as OpenAPIPaths;

// Generate OpenAPI spec
const openApiSpec = createOpenAPISpec('Tickets API', '/tickets', paths);

// Serve OpenAPI JSON
router.get('/openapi.json', (_req: Request, res: Response) => {
  res.json(openApiSpec);
});

// Serve Swagger UI
router.use('/docs', swaggerUi.serve);
router.get('/docs', swaggerUi.setup(openApiSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Tickets API Documentation',
}));

export default router;
