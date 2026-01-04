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
      description: 'Returns the health status of the IAM service',
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
                  service: { type: 'string', example: 'iam-service' },
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
  '/auth/register': {
    post: {
      summary: 'Register new user',
      description: 'Register a new user account. Rate limited to 5 requests per 15 minutes.',
      tags: ['Authentication'],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['email', 'password'],
              properties: {
                email: {
                  type: 'string',
                  format: 'email',
                  example: 'user@example.com',
                },
                password: {
                  type: 'string',
                  minLength: 8,
                  example: 'password123',
                },
                role: {
                  type: 'string',
                  enum: ['resident', 'building_admin', 'manager', 'provider', 'super_admin'],
                  example: 'resident',
                },
              },
            },
          },
        },
      },
      responses: {
        '201': {
          description: 'User registered successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  user: {
                    type: 'object',
                    properties: {
                      id: { type: 'string', format: 'uuid' },
                      email: { type: 'string', format: 'email' },
                      role: { type: 'string' },
                      createdAt: { type: 'string', format: 'date-time' },
                    },
                  },
                  accessToken: { type: 'string' },
                  refreshToken: { type: 'string' },
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
        '409': {
          description: 'User already exists',
          content: {
            'application/json': {
              schema: errorResponseSchema,
            },
          },
        },
      },
    },
  },
  '/auth/login': {
    post: {
      summary: 'Login user',
      description: 'Authenticate user and receive access and refresh tokens. Rate limited to 10 requests per 15 minutes.',
      tags: ['Authentication'],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['email', 'password'],
              properties: {
                email: {
                  type: 'string',
                  format: 'email',
                  example: 'user@example.com',
                },
                password: {
                  type: 'string',
                  example: 'password123',
                },
              },
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Login successful',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  accessToken: { type: 'string' },
                  refreshToken: { type: 'string' },
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
          description: 'Invalid credentials',
          content: {
            'application/json': {
              schema: errorResponseSchema,
            },
          },
        },
      },
    },
  },
  '/auth/refresh': {
    post: {
      summary: 'Refresh access token',
      description: 'Get a new access token using a valid refresh token. Rate limited to 20 requests per minute.',
      tags: ['Authentication'],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['refreshToken'],
              properties: {
                refreshToken: {
                  type: 'string',
                  example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
                },
              },
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Token refreshed successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  accessToken: { type: 'string' },
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
          description: 'Invalid or expired refresh token',
          content: {
            'application/json': {
              schema: errorResponseSchema,
            },
          },
        },
      },
    },
  },
  '/auth/logout': {
    post: {
      summary: 'Logout user',
      description: 'Invalidate a refresh token to log out the user',
      tags: ['Authentication'],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['refreshToken'],
              properties: {
                refreshToken: {
                  type: 'string',
                  example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
                },
              },
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Logout successful',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
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
      },
    },
  },
  '/me': {
    get: {
      summary: 'Get current user profile',
      description: 'Get the authenticated user\'s profile information',
      tags: ['User Profile'],
      security: [{ bearerAuth: [] }],
      responses: {
        '200': {
          description: 'User profile retrieved successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  id: { type: 'string', format: 'uuid' },
                  email: { type: 'string', format: 'email' },
                  role: { type: 'string' },
                  createdAt: { type: 'string', format: 'date-time' },
                },
              },
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
          description: 'User not found',
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
const openApiSpec = createOpenAPISpec('IAM API', '/iam', paths);

// Serve OpenAPI JSON
router.get('/openapi.json', (_req: Request, res: Response) => {
  res.json(openApiSpec);
});

// Serve Swagger UI
router.use('/docs', swaggerUi.serve);
router.get('/docs', swaggerUi.setup(openApiSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'IAM API Documentation',
}));

export default router;
