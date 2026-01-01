# ABOS Platform

Microservices platform foundation built with Express + TypeScript + Node.js v22.15.1.

## Architecture

This platform follows a microservices architecture with:

- **Monorepo structure** using Turborepo + pnpm workspaces
- **Shared packages** for common functionality
- **Event-driven communication** via RabbitMQ
- **Per-service databases** using PostgreSQL
- **Redis** for caching and rate limiting

## Project Structure

```
abos/
├── packages/              # Shared packages
│   ├── @common/env       # Environment variable validation
│   ├── @common/logger    # Structured logging (Winston)
│   ├── @common/http      # Express utilities & middleware
│   └── @common/events    # RabbitMQ client & event handling
├── services/             # Microservices
│   └── template-service  # Hello world service template
├── docs/                 # Architecture documentation
└── docker-compose.yml    # Infrastructure services
```

## Prerequisites

- Node.js >= 22.15.1
- pnpm >= 8.0.0
- Docker & Docker Compose

## Getting Started

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Start Infrastructure Services

```bash
pnpm docker:up
```

This starts:
- PostgreSQL (port 5432)
- RabbitMQ (ports 5672, 15672 for management UI)
- Redis (port 6379)

### 3. Configure Environment Variables

Copy `.env.example` to `.env` and adjust as needed:

```bash
cp .env.example .env
```

### 4. Build Shared Packages

```bash
pnpm build
```

### 5. Run Template Service

```bash
cd services/template-service
pnpm dev
```

Or from root:

```bash
pnpm dev
```

### 6. Test Health Endpoint

```bash
curl http://localhost:3000/health
```

Expected response:

```json
{
  "status": "ok",
  "service": "template-service",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 123.456
}
```

## Available Scripts

### Root Level

- `pnpm dev` - Start all services in development mode
- `pnpm build` - Build all packages and services
- `pnpm lint` - Lint all packages and services
- `pnpm test` - Run tests across all packages and services
- `pnpm docker:up` - Start infrastructure services
- `pnpm docker:down` - Stop infrastructure services
- `pnpm docker:logs` - View infrastructure logs

### Package/Service Level

Each package and service has its own scripts:
- `build` - Compile TypeScript
- `dev` - Watch mode for development

## Infrastructure Services

### PostgreSQL

- **Host:** localhost
- **Port:** 5432
- **User:** postgres
- **Password:** postgres
- **Management:** Connect via psql or any PostgreSQL client

### RabbitMQ

- **AMQP Port:** 5672
- **Management UI:** http://localhost:15672
- **Credentials:** guest / guest
- **Exchange:** `app.events` (topic exchange)

### Redis

- **Port:** 6379
- **No password** (development only)

## Shared Packages

### @common/env

Environment variable validation using Zod.

```typescript
import { getEnv } from '@common/env';

const env = getEnv();
console.log(env.PORT);
```

### @common/logger

Structured logging with Winston.

```typescript
import { createLogger } from '@common/logger';

const logger = createLogger('my-service');
logger.info('Service started', { port: 3000 });
```

### @common/http

Express utilities and middleware.

```typescript
import express from 'express';
import { errorHandler, requestLogger, healthCheckRoute } from '@common/http';
import { createLogger } from '@common/logger';

const app = express();
const logger = createLogger('my-service');

app.use(requestLogger(logger));
app.get('/health', healthCheckRoute('my-service'));
app.use(errorHandler);
```

### @common/events

RabbitMQ event publishing and consumption.

```typescript
import { EventPublisher, EventConsumer, createEventId } from '@common/events';

// Publishing
const publisher = new EventPublisher();
await publisher.publish('user.created', {
  eventId: await createEventId(),
  version: 'v1',
  eventType: 'user.created',
  timestamp: new Date().toISOString(),
  payload: { userId: '123', email: 'user@example.com' },
});

// Consuming
const consumer = new EventConsumer('my-service.q');
await consumer.bind('user.*');
consumer.on('user.created', async (event) => {
  console.log('User created:', event.payload);
});
await consumer.start();
```

## Creating a New Service

1. Copy `services/template-service` to `services/your-service`
2. Update `package.json` name and dependencies
3. Update environment variables in `.env.example`
4. Implement your service logic
5. Add service-specific routes and handlers

## Development Workflow

1. Start infrastructure: `pnpm docker:up`
2. Build packages: `pnpm build`
3. Run services: `pnpm dev`
4. Make changes - TypeScript will recompile automatically
5. Test endpoints using curl, Postman, or your API client

## Documentation

- [Microservices Architecture](./docs/microservices-architecture.md)
- [RabbitMQ Integration](./docs/rabbitmq-integration.md)
- [Tech Stack & Database](./docs/tech-stack-and-database.md)

## Next Steps

- Implement IAM service
- Set up database migrations
- Add authentication middleware
- Implement event-driven workflows
- Add monitoring and observability

## License

Private - Internal use only

