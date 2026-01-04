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
      description: 'Returns the health status of the Notifications service',
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
                  service: { type: 'string', example: 'notifications-service' },
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
  '/': {
    get: {
      summary: 'List user notifications',
      description: 'Get paginated list of notifications for the authenticated user',
      tags: ['Notifications'],
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: 'limit',
          in: 'query',
          schema: {
            type: 'integer',
            minimum: 1,
            maximum: 100,
            default: 50,
          },
          description: 'Maximum number of notifications to return',
        },
        {
          name: 'offset',
          in: 'query',
          schema: {
            type: 'integer',
            minimum: 0,
            default: 0,
          },
          description: 'Number of notifications to skip',
        },
      ],
      responses: {
        '200': {
          description: 'List of notifications',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  notifications: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        id: { type: 'string', format: 'uuid' },
                        userId: { type: 'string', format: 'uuid' },
                        type: { type: 'string', example: 'ticket_created' },
                        title: { type: 'string', example: 'New ticket created' },
                        body: { type: 'string', example: 'A new ticket has been created in your building' },
                        data: { type: 'object', additionalProperties: true },
                        readAt: { type: 'string', format: 'date-time', nullable: true },
                        createdAt: { type: 'string', format: 'date-time' },
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
  '/{id}': {
    get: {
      summary: 'Get notification by ID',
      description: 'Get a specific notification by its ID. Users can only access their own notifications.',
      tags: ['Notifications'],
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: 'id',
          in: 'path',
          required: true,
          schema: {
            type: 'string',
            format: 'uuid',
          },
          description: 'UUID of the notification',
        },
      ],
      responses: {
        '200': {
          description: 'Notification details',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  id: { type: 'string', format: 'uuid' },
                  userId: { type: 'string', format: 'uuid' },
                  type: { type: 'string', example: 'ticket_created' },
                  title: { type: 'string', example: 'New ticket created' },
                  body: { type: 'string', example: 'A new ticket has been created in your building' },
                  data: { type: 'object', additionalProperties: true },
                  readAt: { type: 'string', format: 'date-time', nullable: true },
                  createdAt: { type: 'string', format: 'date-time' },
                },
              },
            },
          },
        },
        '400': {
          description: 'Invalid notification ID format',
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
        '404': {
          description: 'Notification not found',
          content: {
            'application/json': {
              schema: errorResponseSchema,
            },
          },
        },
      },
    },
  },
  '/{id}/read': {
    patch: {
      summary: 'Mark notification as read',
      description: 'Mark a notification as read by setting its readAt timestamp',
      tags: ['Notifications'],
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: 'id',
          in: 'path',
          required: true,
          schema: {
            type: 'string',
            format: 'uuid',
          },
          description: 'UUID of the notification',
        },
      ],
      responses: {
        '200': {
          description: 'Notification marked as read',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  id: { type: 'string', format: 'uuid' },
                  userId: { type: 'string', format: 'uuid' },
                  type: { type: 'string', example: 'ticket_created' },
                  title: { type: 'string', example: 'New ticket created' },
                  body: { type: 'string', example: 'A new ticket has been created in your building' },
                  data: { type: 'object', additionalProperties: true },
                  readAt: { type: 'string', format: 'date-time', nullable: true },
                  createdAt: { type: 'string', format: 'date-time' },
                },
              },
            },
          },
        },
        '400': {
          description: 'Invalid notification ID format',
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
        '404': {
          description: 'Notification not found',
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
const openApiSpec = createOpenAPISpec('Notifications API', '/notifications', paths);

// Serve OpenAPI JSON
router.get('/openapi.json', (_req: Request, res: Response) => {
  res.json(openApiSpec);
});

// Serve Swagger UI
router.use('/docs', swaggerUi.serve);
router.get('/docs', swaggerUi.setup(openApiSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Notifications API Documentation',
}));

export default router;
