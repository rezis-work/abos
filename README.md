# ABOS Platform

A microservices-based building management platform built with Express, TypeScript, and Node.js.

## 🏗️ What is ABOS?

ABOS is a comprehensive platform for managing residential buildings, including:
- **User authentication & authorization** (IAM)
- **Building & unit management**
- **Maintenance ticket system**
- **Community posts & discussions**
- **Visitor pass management**
- **Notifications**

## 🚀 Quick Start

### Prerequisites

- Node.js >= 22.15.1
- pnpm >= 8.0.0
- Docker & Docker Compose

### Installation

```bash
# Install dependencies
pnpm install

# Build all packages and services
pnpm build
```

### Start Development Environment

```bash
# Start infrastructure services (PostgreSQL, RabbitMQ, Redis)
pnpm docker:up

# Start all services in development mode
pnpm dev
```

### Start Production Environment

```bash
# Build production Docker images
pnpm docker:build

# Start all services
pnpm docker:up
```

## 📦 Services

The platform consists of 6 microservices:

| Service | Port | Description |
|---------|------|-------------|
| **IAM** | 3001 | User authentication, registration, JWT tokens |
| **Buildings** | 3002 | Building & unit management, resident verification |
| **Notifications** | 3003 | User notifications (event-driven) |
| **Tickets** | 3004 | Maintenance ticket management |
| **Community** | 3005 | Posts, comments, building discussions |
| **Access** | 3006 | Visitor pass management |

All services are accessible through the **Nginx Gateway** on port **80**.

## 🎯 Key Features

### Authentication & Authorization
- User registration and login
- JWT-based authentication (access + refresh tokens)
- Role-based access control (RBAC)
- Rate limiting on auth endpoints

### Building Management
- Create and manage buildings
- Unit management (bulk creation)
- Resident membership and verification
- Access control per building

### Maintenance Tickets
- Create tickets (residents)
- Assign tickets to providers (admins)
- Track ticket status (open → in_progress → resolved → closed)
- Add comments to tickets

### Community Features
- Create posts in building communities
- Comment on posts
- Verified members only (ensures building residents)

### Visitor Passes
- Create visitor passes (residents)
- Time-based validity windows
- Mark passes as used (guards/admins)
- Revoke passes

### Notifications
- Event-driven notifications
- Real-time updates for tickets, passes, posts
- Mark as read functionality

## 🏃 Available Commands

### Development

```bash
pnpm dev              # Start all services in watch mode
pnpm build            # Build all packages and services
pnpm lint             # Lint all code
pnpm typecheck        # Type check all code
```

### Testing

```bash
pnpm test             # Run all tests
pnpm test:unit        # Run unit tests only
pnpm test:integration # Run integration tests (requires Docker)
```

### Docker

```bash
pnpm docker:up              # Start infrastructure services
pnpm docker:down            # Stop infrastructure services
pnpm docker:build           # Build production images
pnpm docker:build:no-cache  # Build without cache
pnpm docker:logs            # View logs
```

### Integration Tests

```bash
pnpm test:integration:up    # Start test Docker stack
pnpm test:integration:down  # Stop test Docker stack
pnpm test:integration       # Run full integration test suite
```

## 🏛️ Architecture

### Microservices Architecture

```
┌─────────────┐
│   Nginx     │  API Gateway (port 80)
│   Gateway   │
└──────┬──────┘
       │
   ┌───┴─────────────────────────────────────┐
   │                                           │
┌──▼──┐  ┌──────────┐  ┌──────────┐  ┌──────┐
│ IAM │  │Buildings│  │Tickets   │  │ ...  │
└──┬──┘  └────┬─────┘  └────┬─────┘  └──┬───┘
   │          │             │           │
   └──────────┴─────────────┴───────────┘
              │
         ┌────▼─────┐
         │ RabbitMQ │  Event Bus
         └──────────┘
```

### Technology Stack

- **Runtime:** Node.js 22.15.1
- **Language:** TypeScript
- **Framework:** Express.js
- **Database:** PostgreSQL (per-service)
- **Message Queue:** RabbitMQ
- **Cache:** Redis
- **Gateway:** Nginx
- **Build Tool:** Turborepo
- **Package Manager:** pnpm

### Event-Driven Communication

Services communicate via events published to RabbitMQ:
- **Exchange:** `app.events` (topic exchange)
- **Pattern:** Event-driven architecture with outbox pattern
- **Reliability:** Idempotency handling, retry logic

## 📁 Project Structure

```
abos/
├── packages/              # Shared packages
│   ├── common-env        # Environment validation
│   ├── common-logger      # Structured logging
│   ├── common-http        # Express utilities
│   └── common-events      # RabbitMQ client
├── services/             # Microservices
│   ├── iam              # Identity & Access Management
│   ├── buildings        # Building & unit management
│   ├── notifications    # Notification service
│   ├── tickets          # Ticket management
│   ├── community        # Community posts
│   └── access           # Visitor passes
├── tests/               # Integration tests
├── infra/               # Infrastructure configs
│   └── nginx/          # Nginx configuration
└── docker-compose.yml   # Production services
```

## 🔐 User Roles

- **resident** - Basic user, can create tickets, posts, visitor passes
- **building_admin** - Can manage their building (units, memberships, tickets)
- **manager** - Platform-level admin, can manage multiple buildings
- **provider** - Service provider, can be assigned tickets
- **super_admin** - Full platform access

## 🌐 API Endpoints

All endpoints are prefixed with the service name (e.g., `/iam/auth/login`, `/buildings/...`).

### Health Checks
- `GET /iam/health`
- `GET /buildings/health`
- `GET /notifications/health`
- `GET /tickets/health`
- `GET /community/health`
- `GET /access/health`

### Swagger Documentation
Each service provides Swagger UI documentation:
- `GET /iam/docs`
- `GET /buildings/docs`
- `GET /notifications/docs`
- `GET /tickets/docs`
- `GET /community/docs`
- `GET /access/docs`

## 🔧 Environment Variables

Each service uses environment variables for configuration. See `.env.example` files in each service directory.

**Common variables:**
- `NODE_ENV` - Environment (development/production/test)
- `PORT` - Service port
- `DATABASE_URL` - PostgreSQL connection string
- `RABBITMQ_URL` - RabbitMQ connection string
- `REDIS_URL` - Redis connection string
- `JWT_SECRET` - Secret for JWT token signing

## 📚 Documentation

- [Microservices Architecture](./docs/microservices-architecture.md)
- [RabbitMQ Integration](./docs/rabbitmq-integration.md)
- [Tech Stack & Database](./docs/tech-stack-and-database.md)

## 🧪 Testing

### Unit Tests
```bash
pnpm test:unit
```

### Integration Tests
Integration tests require the Docker test stack to be running:

```bash
# Start test stack
pnpm test:integration:up

# Run tests
pnpm test:integration

# Stop test stack
pnpm test:integration:down
```

## 🐳 Docker

### Development
```bash
docker compose up -d
```

### Production
```bash
docker compose -f docker-compose.yml up -d --build
```

### Test Environment
```bash
docker compose -f docker-compose.test.yml up -d --build
```

## 📝 Development Workflow

1. **Start infrastructure:**
   ```bash
   pnpm docker:up
   ```

2. **Build packages:**
   ```bash
   pnpm build
   ```

3. **Start services:**
   ```bash
   pnpm dev
   ```

4. **Make changes** - TypeScript will recompile automatically

5. **Test endpoints** using curl, Postman, or your API client

## 🚨 Troubleshooting

### Services won't start
- Check Docker is running: `docker ps`
- Check ports aren't in use
- Check logs: `pnpm docker:logs`

### Database connection errors
- Ensure PostgreSQL is running: `docker ps | grep postgres`
- Check database credentials in `.env` files
- Verify database exists (services create them automatically)

### RabbitMQ connection errors
- Ensure RabbitMQ is running: `docker ps | grep rabbitmq`
- Check RabbitMQ management UI: http://localhost:15672 (guest/guest)

## 📄 License

Private - Internal use only
