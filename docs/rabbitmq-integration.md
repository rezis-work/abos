# RabbitMQ Integration Guide

## Overview

This document describes how microservices communicate using RabbitMQ as the message broker. RabbitMQ enables asynchronous, event-driven communication between services, providing scalability and resilience.

---

## Exchange Strategy

### Topic Exchange: `app.events`

We use a **topic exchange** named `app.events` for all inter-service communication. This provides flexibility and scalability for routing events.

**Why Topic Exchange?**
- Flexible routing patterns
- Easy to add new consumers without modifying publishers
- Supports wildcard matching for event subscriptions
- Scales well as the system grows

---

## Routing Keys

Routing keys follow a consistent pattern: `{domain}.{action}`

### Examples:
- `user.created`
- `user.updated`
- `user.role_changed`
- `user.deleted`
- `resident.verified`
- `resident.unverified`
- `building.created`
- `unit.assigned_to_user`
- `post.created`
- `comment.created`
- `message.sent`
- `content.flagged`
- `ticket.created`
- `ticket.assigned`
- `ticket.status_changed`
- `ticket.closed`
- `booking.created`
- `booking.cancelled`
- `booking.checked_in`
- `resource.updated`
- `provider.created`
- `provider.verified`
- `service.listing_created`
- `quote.requested`
- `job.booked`
- `payment.initiated`
- `payment.succeeded`
- `payment.failed`
- `refund.issued`
- `invoice.created`
- `notification.sent`
- `notification.failed`
- `ai.summary_ready`
- `ai.moderation_result`

---

## Queue Architecture

Each service maintains its own dedicated queues for consuming events.

### Queue Naming Convention

Queues follow the pattern: `{service-name}.q`

### Service Queues:
- `notifications.q`
- `ai.q`
- `search.q`
- `billing.q`
- `community.q`
- `tickets.q`
- `booking.q`
- `marketplace.q`

---

## Binding Patterns

Services bind their queues to the `app.events` exchange using routing key patterns.

### Notification Service Bindings
**Queue:** `notifications.q`

**Patterns:**
- `*.created` (all creation events)
- `*.status_changed` (all status change events)
- `payment.*` (all payment-related events)

**Examples of events consumed:**
- `ticket.created`
- `ticket.status_changed`
- `booking.created`
- `payment.succeeded`
- `payment.failed`
- `resident.verified`

---

### AI Service Bindings
**Queue:** `ai.q`

**Patterns:**
- `post.created`
- `message.sent`
- `ticket.created`

**Purpose:** AI service processes content for moderation, summarization, and Q&A.

---

### Payments & Billing Service Bindings
**Queue:** `billing.q`

**Patterns:**
- `booking.created`
- `job.booked`
- `quote.accepted`

**Purpose:** Trigger payment processing for bookings and marketplace jobs.

---

### Search Service Bindings
**Queue:** `search.q`

**Patterns:**
- `post.created`
- `ticket.created`
- `provider.created`
- `service.listing_created`
- `resource.updated`

**Purpose:** Update search index when content is created or modified.

---

## Reliability Rules (Must-Have)

### 1. Outbox Pattern

**Requirement:** Each service must implement the Outbox Pattern.

**How it works:**
- When a service needs to publish an event, it writes the event to an outbox table in the same database transaction
- A separate process (outbox publisher) reads from the outbox table and publishes to RabbitMQ
- This ensures **atomicity**: either both the database write and event publish succeed, or both fail

**Benefits:**
- Guarantees eventual consistency
- Prevents lost events
- Ensures database and event store stay in sync

---

### 2. Idempotent Consumers

**Requirement:** All event consumers must be idempotent.

**How it works:**
- Each event includes a unique `eventId`
- Consumers check if they've already processed this `eventId` before processing
- If already processed, skip or return success without side effects

**Benefits:**
- Prevents duplicate processing
- Handles retries safely
- Ensures exactly-once semantics (or at-least-once with idempotency)

---

### 3. Dead Letter Queue (DLQ)

**Requirement:** Each service must have its own DLQ.

**Naming Convention:** `{service-name}.dlq`

**Examples:**
- `notifications.dlq`
- `ai.dlq`
- `search.dlq`
- `billing.dlq`

**How it works:**
- Messages that fail processing after all retries are sent to the DLQ
- DLQ messages can be inspected, fixed, and reprocessed manually
- Prevents message loss and provides visibility into failures

---

### 4. Retry with Backoff

**Requirement:** Implement exponential backoff for retries.

**Strategy:**
- First retry: immediate
- Second retry: 1 second delay
- Third retry: 2 seconds delay
- Fourth retry: 4 seconds delay
- Fifth retry: 8 seconds delay
- After max retries: send to DLQ

**Benefits:**
- Reduces load on failing services
- Handles transient failures gracefully
- Prevents retry storms

---

### 5. Schema Versioning

**Requirement:** Include version information in event payloads.

**Format:** Include `version` field in event payload (e.g., `v1`, `v2`)

**Example Event Structure:**
```json
{
  "eventId": "uuid",
  "version": "v1",
  "eventType": "user.created",
  "timestamp": "2024-01-01T00:00:00Z",
  "payload": {
    "userId": "uuid",
    "email": "user@example.com",
    ...
  }
}
```

**Benefits:**
- Enables schema evolution without breaking consumers
- Consumers can handle multiple versions
- Easier to deprecate old versions gradually

---

## Communication Patterns

### When to Use Sync (HTTP/gRPC)

**Use synchronous communication only for:**

1. **Gateway → Services (Queries)**
   - API Gateway makes direct HTTP/gRPC calls to services for queries
   - Needed for immediate responses to user requests
   - Examples: Get user profile, list tickets, fetch booking details

2. **Service → Service (Rare)**
   - Only when you need an immediate response
   - Only when the operation is critical and cannot be async
   - Examples: Validate user exists before creating ticket, check availability before booking

**Keep it minimal:** Most inter-service communication should be async.

---

### When to Use Async (RabbitMQ)

**Use asynchronous communication for:**

- **Notifications** (email, SMS, push notifications)
- **Analytics** (tracking events, metrics)
- **Indexing** (updating search indexes)
- **AI Processing** (moderation, summarization)
- **Payment Updates** (payment status changes)
- **Status Updates** (ticket status, booking status)
- **Any fire-and-forget operations**
- **Any operation that doesn't need immediate response**

**Benefits:**
- Better performance (non-blocking)
- Improved resilience (services can be temporarily unavailable)
- Better scalability (can handle bursts)
- Loose coupling between services

---

## MVP Microservices (Leanest Approach)

For the initial MVP, start with **6 core microservices**:

### Core MVP Services:

1. **IAM Service**
   - User management
   - Authentication
   - Authorization

2. **Building/Residency Service**
   - Buildings and units
   - Resident verification

3. **Community Service**
   - Posts and messages
   - Feed functionality

4. **Tickets Service**
   - Maintenance requests
   - Issue tracking

5. **Booking Service**
   - Resource reservations
   - Workspace booking

6. **Notifications Service**
   - Email/SMS/Push notifications

### Add Later:

- **Marketplace Service** (after core features are stable)
- **Payments Service** (after booking/marketplace are proven)
- **AI Service** (after core product is validated)

---

## Best Practices

1. **Event Naming:** Use consistent, descriptive event names (`domain.action`)
2. **Queue Isolation:** Each service has its own queue(s) - never share queues
3. **Error Handling:** Always implement DLQ and retry logic
4. **Monitoring:** Monitor queue depths, processing times, and DLQ sizes
5. **Testing:** Test event publishing and consumption in isolation
6. **Documentation:** Document all events published and consumed by each service
7. **Versioning:** Always version your event schemas
8. **Idempotency:** Make all operations idempotent to handle duplicates safely

---

## Example Flow: Ticket Creation

1. **User creates ticket** → API Gateway (HTTP)
2. **API Gateway** → Tickets Service (HTTP) - Create ticket
3. **Tickets Service** saves ticket to DB + writes to outbox table (atomic transaction)
4. **Outbox Publisher** reads from outbox and publishes `ticket.created` to `app.events`
5. **Notification Service** (via `notifications.q`) receives event → sends notification
6. **Search Service** (via `search.q`) receives event → updates search index
7. **AI Service** (via `ai.q`) receives event → processes for moderation (if needed)

All steps 4-7 happen asynchronously without blocking the original request.

