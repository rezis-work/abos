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
      description: 'Returns the health status of the Community service',
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
                  service: { type: 'string', example: 'community-service' },
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
  '/buildings/{buildingId}/posts': {
    post: {
      summary: 'Create a post',
      description: 'Create a new post for a building. Requires verified member status.',
      tags: ['Posts'],
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
              required: ['title', 'content'],
              properties: {
                title: {
                  type: 'string',
                  minLength: 1,
                  maxLength: 255,
                  example: 'Community BBQ this weekend',
                },
                content: {
                  type: 'string',
                  minLength: 1,
                  example: 'Join us for a community BBQ this Saturday at 2 PM in the courtyard!',
                },
              },
            },
          },
        },
      },
      responses: {
        '201': {
          description: 'Post created successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: {
                    type: 'object',
                    properties: {
                      id: { type: 'string', format: 'uuid' },
                      buildingId: { type: 'string', format: 'uuid' },
                      userId: { type: 'string', format: 'uuid' },
                      title: { type: 'string' },
                      content: { type: 'string' },
                      status: { type: 'string', enum: ['active', 'deleted'] },
                      createdAt: { type: 'string', format: 'date-time' },
                      updatedAt: { type: 'string', format: 'date-time' },
                    },
                  },
                  requestId: { type: 'string' },
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
          description: 'Forbidden - User is not a verified member',
          content: {
            'application/json': {
              schema: errorResponseSchema,
            },
          },
        },
      },
    },
    get: {
      summary: 'List posts for a building',
      description: 'Get paginated list of posts for a building. Requires verified member status.',
      tags: ['Posts'],
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
          description: 'Maximum number of posts to return',
        },
        {
          name: 'offset',
          in: 'query',
          schema: {
            type: 'integer',
            minimum: 0,
            default: 0,
          },
          description: 'Number of posts to skip',
        },
      ],
      responses: {
        '200': {
          description: 'List of posts',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        id: { type: 'string', format: 'uuid' },
                        buildingId: { type: 'string', format: 'uuid' },
                        userId: { type: 'string', format: 'uuid' },
                        title: { type: 'string' },
                        content: { type: 'string' },
                        status: { type: 'string', enum: ['active', 'deleted'] },
                        createdAt: { type: 'string', format: 'date-time' },
                        updatedAt: { type: 'string', format: 'date-time' },
                      },
                    },
                  },
                  requestId: { type: 'string' },
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
          description: 'Forbidden - User is not a verified member',
          content: {
            'application/json': {
              schema: errorResponseSchema,
            },
          },
        },
      },
    },
  },
  '/posts/{postId}': {
    get: {
      summary: 'Get post by ID',
      description: 'Get a specific post by its ID. User must be a verified member of the post\'s building.',
      tags: ['Posts'],
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: 'postId',
          in: 'path',
          required: true,
          schema: {
            type: 'string',
            format: 'uuid',
          },
          description: 'UUID of the post',
        },
      ],
      responses: {
        '200': {
          description: 'Post details',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: {
                    type: 'object',
                    properties: {
                      id: { type: 'string', format: 'uuid' },
                      buildingId: { type: 'string', format: 'uuid' },
                      userId: { type: 'string', format: 'uuid' },
                      title: { type: 'string' },
                      content: { type: 'string' },
                      status: { type: 'string', enum: ['active', 'deleted'] },
                      createdAt: { type: 'string', format: 'date-time' },
                      updatedAt: { type: 'string', format: 'date-time' },
                    },
                  },
                  requestId: { type: 'string' },
                },
              },
            },
          },
        },
        '400': {
          description: 'Invalid post ID format',
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
          description: 'Forbidden - User is not a verified member of the post\'s building',
          content: {
            'application/json': {
              schema: errorResponseSchema,
            },
          },
        },
        '404': {
          description: 'Post not found',
          content: {
            'application/json': {
              schema: errorResponseSchema,
            },
          },
        },
      },
    },
  },
  '/posts/{postId}/comments': {
    post: {
      summary: 'Create a comment',
      description: 'Create a comment on a post. User must be a verified member of the post\'s building.',
      tags: ['Comments'],
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: 'postId',
          in: 'path',
          required: true,
          schema: {
            type: 'string',
            format: 'uuid',
          },
          description: 'UUID of the post',
        },
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['content'],
              properties: {
                content: {
                  type: 'string',
                  minLength: 1,
                  example: 'Looking forward to it!',
                },
              },
            },
          },
        },
      },
      responses: {
        '201': {
          description: 'Comment created successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: {
                    type: 'object',
                    properties: {
                      id: { type: 'string', format: 'uuid' },
                      postId: { type: 'string', format: 'uuid' },
                      userId: { type: 'string', format: 'uuid' },
                      content: { type: 'string' },
                      status: { type: 'string', enum: ['active', 'deleted'] },
                      createdAt: { type: 'string', format: 'date-time' },
                      updatedAt: { type: 'string', format: 'date-time' },
                    },
                  },
                  requestId: { type: 'string' },
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
          description: 'Forbidden - User is not a verified member of the post\'s building',
          content: {
            'application/json': {
              schema: errorResponseSchema,
            },
          },
        },
        '404': {
          description: 'Post not found',
          content: {
            'application/json': {
              schema: errorResponseSchema,
            },
          },
        },
      },
    },
    get: {
      summary: 'List comments for a post',
      description: 'Get paginated list of comments for a post. User must be a verified member of the post\'s building.',
      tags: ['Comments'],
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: 'postId',
          in: 'path',
          required: true,
          schema: {
            type: 'string',
            format: 'uuid',
          },
          description: 'UUID of the post',
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
          description: 'Maximum number of comments to return',
        },
        {
          name: 'offset',
          in: 'query',
          schema: {
            type: 'integer',
            minimum: 0,
            default: 0,
          },
          description: 'Number of comments to skip',
        },
      ],
      responses: {
        '200': {
          description: 'List of comments',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        id: { type: 'string', format: 'uuid' },
                        postId: { type: 'string', format: 'uuid' },
                        userId: { type: 'string', format: 'uuid' },
                        content: { type: 'string' },
                        status: { type: 'string', enum: ['active', 'deleted'] },
                        createdAt: { type: 'string', format: 'date-time' },
                        updatedAt: { type: 'string', format: 'date-time' },
                      },
                    },
                  },
                  requestId: { type: 'string' },
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
          description: 'Forbidden - User is not a verified member of the post\'s building',
          content: {
            'application/json': {
              schema: errorResponseSchema,
            },
          },
        },
        '404': {
          description: 'Post not found',
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
const openApiSpec = createOpenAPISpec('Community API', '/community', paths);

// Serve OpenAPI JSON
router.get('/openapi.json', (_req: Request, res: Response) => {
  res.json(openApiSpec);
});

// Serve Swagger UI
router.use('/docs', swaggerUi.serve);
router.get('/docs', swaggerUi.setup(openApiSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Community API Documentation',
}));

export default router;
