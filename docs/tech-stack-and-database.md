# Tech Stack & Database Architecture

## Overview

This document outlines the technology stack and database architecture for the microservices platform. The stack is designed for production use with Express + TypeScript + Node.js v22.15.1.

---

## Database Strategy

### Primary Database: PostgreSQL

**Why PostgreSQL as the default:**

- ✅ **Works great for transactions** - Essential for payments, bookings, tickets
- ✅ **Strong relations + constraints** - Perfect for buildings → units → residents relationships
- ✅ **Easy reporting/analytics** - Built-in support for complex queries and aggregations
- ✅ **Mature tooling** - Extensive ecosystem, monitoring, and backup solutions
- ✅ **Scaling capabilities** - Proven track record for production workloads

### Per Microservice Database Rule

**Critical Principle:** Each microservice owns its own PostgreSQL database/schema.

**Rules:**
- Other services **never read** another service's database directly
- Services communicate through **events via RabbitMQ**
- Each service is the **single source of truth** for its domain
- Enables independent scaling, deployment, and schema evolution

---

## Microservice → Database Mapping

### 1. IAM (Identity & Access) Service

**Database:** `iam_db` (PostgreSQL)

**Stores:**
- Users
- Roles
- Permissions
- Refresh tokens
- Sessions
- OAuth identities

**Key Indexes:**
- `email` (unique)
- `userId` (primary key)
- `role` indexes for RBAC queries

---

### 2. Building & Residency Service

**Database:** `building_db` (PostgreSQL)

**Stores:**
- Buildings
- Entrances
- Units
- Resident-unit membership
- Verification status

**Why Postgres:** Strong relational integrity and constraints ensure data consistency for complex building hierarchies.

---

### 3. Community Feed & Messaging Service

**Database:** `community_db` (PostgreSQL)

**Stores:**
- Posts
- Comments
- Reactions
- Channels
- Messages metadata

**File Storage:**
- **UploadThing** for images/files
- Database stores only: `fileUrl`, `mime`, `size`, `ownerId`

**Future Considerations:**
- If chat becomes heavy, consider:
  - Splitting chat to its own service
  - Adding read replicas for better read performance

---

### 4. Requests & Maintenance (Tickets) Service

**Database:** `tickets_db` (PostgreSQL)

**Stores:**
- Tickets
- Assignments
- Status history
- SLA timestamps
- Tags

---

### 5. Workspace & Resource Booking Service

**Database:** `booking_db` (PostgreSQL)

**Stores:**
- Resources
- Availability rules
- Reservations
- Cancellations
- Check-ins

**Critical Implementation:**
- Use **transactions** + **unique constraints** to prevent double-booking
- Ensure atomic reservation operations

---

### 6. Marketplace (Local Services) Service

**Database:** `marketplace_db` (PostgreSQL)

**Stores:**
- Providers
- Listings
- Availability
- Quote requests
- Job bookings

**Note:** Reviews can live here or in a separate "Reviews" service later (depending on scale).

---

### 7. Payments & Billing Service

**Database:** `payments_db` (PostgreSQL)

**Stores:**
- Transactions
- Invoices
- Refunds
- Commission rules
- Payouts ledger

**Critical Rule:** Implement strict **audit log tables** (append-only ledger style) for financial compliance and traceability.

---

### 8. Notifications Service

**Database:** `notifications_db` (PostgreSQL)

**Stores:**
- Templates
- User preferences
- Delivery logs
- Retries
- Provider responses

---

### 9. AI Service (Optional Add-on)

**Database:** `ai_db` (PostgreSQL)

**Stores:**
- Conversation metadata
- Usage logs

**Vector Store Options:**

1. **pgvector** (inside Postgres) - Simplest, great for MVP
   - Extends PostgreSQL with vector similarity search
   - No additional infrastructure needed
   - Good performance for moderate scale

2. **Qdrant** (dedicated vector DB) - If you want dedicated vector DB later
   - Better for high-scale vector operations
   - Specialized for embeddings and similarity search
   - Consider when pgvector becomes a bottleneck

---

## Redis Usage

### Where Redis Helps Most

Redis is **not required everywhere**, but very useful for specific use cases:

#### 1. API Gateway
- **Rate limiting** - Track request counts per user/IP
- **Request caching** - Cache frequently accessed data

#### 2. Search Service
- **Search suggestions** - Cache autocomplete results
- **Facets** - Cache computed search facets and filters

#### 3. Booking Service
- **Short-lived "holds"** - 3-minute reservation locks
- Prevents double-booking during checkout process

#### 4. Notifications Service
- **Dedupe keys** - Prevent duplicate notifications
- **Job throttling** - Control notification rate per user

#### 5. AI Service
- **Cache embeddings** - Store frequently accessed embeddings
- **Recent answers** - Cache common queries
- **Session context** - Store conversation context

### Redis Architecture

**Recommendation:** 1 Redis cluster shared infrastructure is fine.

**Key Management:** Use **namespaced keys per service** to avoid conflicts.

**Example Key Patterns:**
- `gateway:ratelimit:{userId}`
- `booking:hold:{resourceId}:{timeSlot}`
- `notifications:dedupe:{eventId}`
- `ai:cache:{queryHash}`

---

## File Storage

### UploadThing

**Purpose:** Store images, attachments, and other files.

**Why UploadThing:**
- Simple file upload API with built-in React components
- Automatic image optimization and resizing
- Built-in security and access control
- CDN delivery for fast file serving
- Easy integration with Express/TypeScript backend

**Database Storage:**
- Database stores only metadata:
  - `fileUrl` - Reference to file in UploadThing
  - `mime` - MIME type
  - `size` - File size in bytes
  - `ownerId` - User who uploaded the file

**Benefits:**
- Database stays lightweight
- Files served via CDN automatically
- Built-in image optimization
- Simple API for file management

---

## Infrastructure Recommendations

### Local Development

**Docker Compose Setup:**

```yaml
Services:
  - RabbitMQ (message broker)
  - PostgreSQL (one instance, multiple databases)
  - Redis (caching and rate limiting)
```

**Note:** UploadThing is used for file storage (cloud service, no local setup needed).

**Benefits:**
- Consistent development environment
- Easy to spin up/down
- Matches production architecture
- All services can run locally

---

### Production

**Managed Services (Recommended):**

1. **PostgreSQL**
   - Managed Postgres (AWS RDS, Google Cloud SQL, Azure Database)
   - Automated backups
   - High availability
   - Monitoring and alerting

2. **Redis**
   - Managed Redis (AWS ElastiCache, Redis Cloud, etc.)
   - High availability
   - Automatic failover
   - Monitoring

3. **RabbitMQ**
   - Managed RabbitMQ (CloudAMQP, AWS MQ)
   - Or self-hosted with proper monitoring
   - High availability cluster

4. **File Storage**
   - UploadThing (managed service)
   - Built-in CDN for file delivery
   - Automatic image optimization

---

## Database Schema Principles

### 1. Service Isolation
- Each service has its own database
- No cross-database queries
- Services communicate via events only

### 2. Schema Evolution
- Version your schemas
- Use migrations (e.g., TypeORM, Prisma, Knex)
- Support backward compatibility during transitions

### 3. Indexing Strategy
- Index foreign keys
- Index frequently queried fields
- Index fields used in WHERE clauses
- Monitor query performance

### 4. Constraints
- Use foreign keys within the service's database
- Use unique constraints where appropriate
- Use check constraints for data validation
- Enforce referential integrity

### 5. Audit Logging
- Especially critical for Payments service
- Append-only audit tables
- Track who/what/when for sensitive operations

---

## Technology Stack Summary

### Runtime & Framework
- **Node.js:** v22.15.1
- **Framework:** Express.js
- **Language:** TypeScript

### Databases
- **Primary:** PostgreSQL (per microservice)
- **Cache:** Redis (shared cluster)
- **Vector Store:** pgvector (PostgreSQL extension) or Qdrant

### Message Broker
- **RabbitMQ:** Topic exchange for event-driven communication

### Storage
- **File Storage:** UploadThing

### Development Tools
- **Docker Compose:** Local development environment
- **Migration Tools:** TypeORM, Prisma, or Knex.js

---

## Next Steps

Recommended implementation order:

1. **Set up Docker Compose** with all infrastructure services
2. **Define database schemas** for MVP services
3. **Configure RabbitMQ** exchange and routing keys
4. **Implement outbox pattern** for event publishing
5. **Set up Redis** for caching and rate limiting
6. **Configure UploadThing** for file uploads

---

## Best Practices

1. **Never share databases** between microservices
2. **Always use transactions** for multi-step operations
3. **Implement proper indexing** from the start
4. **Use connection pooling** for database connections
5. **Monitor database performance** (slow queries, connection counts)
6. **Backup regularly** with point-in-time recovery capability
7. **Use migrations** for all schema changes
8. **Test database operations** in isolation
9. **Cache aggressively** but invalidate properly
10. **Use Redis for ephemeral data**, PostgreSQL for persistent data

