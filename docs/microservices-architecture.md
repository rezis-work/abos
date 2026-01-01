# Microservices Architecture

## Overview

This document outlines the recommended microservices architecture for the project. The architecture consists of **9 core microservices** that provide a good balance of separation of concerns, scalability, and maintainability.

---

## Core Microservices

### 1. API Gateway / BFF (Backend for Frontend)

**Purpose:** Single public entrypoint for web/mobile applications, handling routing and aggregation.

**Owns:**
- Authentication middleware
- Rate limiting
- Request validation
- API composition

**Publishes Events:** None (usually)

**Consumes Events:** None

**Notes:** Not a "business" service, but essential for the architecture.

---

### 2. Identity & Access (IAM) Service

**Purpose:** Manages users, roles, permissions, and building-level access control.

**Owns:**
- User accounts
- Roles (resident/admin/manager/provider)
- RBAC policies
- Sessions/JWT tokens

**Publishes Events:**
- `user.created`
- `user.updated`
- `user.role_changed`
- `user.deleted`

**Consumes Events:** None (source of truth)

---

### 3. Building & Residency Service

**Purpose:** Manages buildings, units, resident verification, and tenancy relationships.

**Owns:**
- Buildings
- Entrances
- Floors
- Apartments
- Resident-to-unit mapping
- Verification flow

**Publishes Events:**
- `building.created`
- `unit.assigned_to_user`
- `resident.verified`
- `resident.unverified`

**Consumes Events:**
- `user.created` (optional, to auto-create profile mapping)

---

### 4. Community Feed & Messaging Service

**Purpose:** Handles announcements, posts, comments, reactions, and building chat channels.

**Owns:**
- Posts
- Comments
- Likes/reactions
- Building channels
- Attachment references

**Publishes Events:**
- `post.created`
- `comment.created`
- `message.sent`
- `content.flagged`

**Consumes Events:**
- `resident.verified` (only verified residents can post)
- `user.role_changed` (permissions)

---

### 5. Requests & Maintenance (Tickets) Service

**Purpose:** Manages complaints, maintenance requests, tasks, and status tracking (SLA).

**Owns:**
- Tickets
- Categories
- Assignments
- Statuses
- History timeline

**Publishes Events:**
- `ticket.created`
- `ticket.assigned`
- `ticket.status_changed`
- `ticket.closed`

**Consumes Events:**
- `unit.assigned_to_user` (to know which unit ticket belongs to)
- `user.role_changed` (who can manage)

---

### 6. Workspace & Resource Booking Service

**Purpose:** Handles booking of meeting rooms, coworking spaces, gyms, event halls, time slots, and capacity management.

**Owns:**
- Resources
- Schedules
- Reservations
- Cancellation policy

**Publishes Events:**
- `booking.created`
- `booking.cancelled`
- `booking.checked_in`
- `resource.updated`

**Consumes Events:**
- `resident.verified`
- `payment.succeeded` (if bookings are paid)

---

### 7. Marketplace Service (Local Services)

**Purpose:** Manages service providers (electrician/cleaner), listings, availability, quotes, and reviews pointer.

**Owns:**
- Provider profiles
- Services
- Pricing ranges
- Availability windows

**Publishes Events:**
- `provider.created`
- `provider.verified`
- `service.listing_created`
- `quote.requested`
- `job.booked`

**Consumes Events:**
- `resident.verified`
- `review.created` (to update provider rating summary)

---

### 8. Payments & Billing Service

**Purpose:** Handles payments for bookings/marketplace jobs, invoices, payouts, and commissions.

**Owns:**
- Transactions
- Invoices
- Refunds
- Provider payouts
- Commissions

**Publishes Events:**
- `payment.initiated`
- `payment.succeeded`
- `payment.failed`
- `refund.issued`
- `invoice.created`

**Consumes Events:**
- `booking.created` (if paid booking)
- `job.booked` / `quote.accepted`

---

### 9. Notification Service

**Purpose:** Manages email/SMS/push/in-app notifications.

**Owns:**
- Templates
- Channels
- Delivery logs
- User notification preferences

**Publishes Events:** (optional)
- `notification.sent`
- `notification.failed`

**Consumes Events:**
- `ticket.created`, `ticket.status_changed`
- `message.sent`
- `booking.created`, `booking.cancelled`
- `payment.succeeded`, `payment.failed`
- `resident.verified`
- And other relevant events from various services

---

## Optional Add-ons

### 10. AI Service (RAG + Moderation + Summaries)

**Purpose:** Provides AI assistant capabilities, summarizing building updates, search Q&A, and content moderation.

**Owns:**
- Embeddings store
- Prompt templates
- Conversation memory per building
- Policy rules

**Publishes Events:**
- `ai.summary_ready`
- `ai.moderation_result`

**Consumes Events:**
- `post.created`
- `message.sent`
- `ticket.created`

**Notes:** Keep it separate so AI failures never break core product functionality.

---

### 11. Search Service

**Purpose:** Provides unified search across posts, tickets, providers, and resources.

**Owns:**
- Search index
- Search queries and results

**Publishes Events:** None

**Consumes Events:** Events from many services to build and maintain the search index

---

## Event-Driven Architecture

The microservices communicate primarily through events, enabling:
- **Loose coupling:** Services don't need direct dependencies on each other
- **Scalability:** Services can scale independently
- **Resilience:** Failures in one service don't cascade to others
- **Flexibility:** New services can be added without modifying existing ones

## Key Design Principles

1. **Single Responsibility:** Each service owns a specific domain
2. **Event-Driven:** Services communicate via events for async operations
3. **Source of Truth:** Each service is the authoritative source for its domain
4. **Separation of Concerns:** Business logic is separated from infrastructure concerns
5. **Fault Isolation:** Optional services (like AI) are isolated to prevent core product failures

