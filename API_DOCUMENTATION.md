# ABOS Platform API Documentation

**Base URL:** `https://techgazzeta.com`  
**Version:** 1.0  
**Last Updated:** January 2026

---

## Table of Contents

1. [Authentication](#authentication)
2. [IAM Service](#iam-service)
3. [Buildings Service](#buildings-service)
4. [Community Service](#community-service)
5. [Tickets Service](#tickets-service)
6. [Notifications Service](#notifications-service)
7. [Access Service](#access-service)
8. [Error Handling](#error-handling)
9. [Authentication & Authorization](#authentication--authorization)

---

## Authentication

All protected endpoints require a Bearer token in the Authorization header:

```
Authorization: Bearer <access_token>
```

### Getting an Access Token

1. **Register** a new user account
2. **Login** to receive `accessToken` and `refreshToken`
3. Use `accessToken` for API requests
4. Use `refreshToken` to get a new `accessToken` when it expires

---

## IAM Service

**Base Path:** `/iam`

### Health Check

**GET** `/iam/health`

Check if the IAM service is running.

**Response:**

```json
{
  "status": "ok",
  "service": "iam-service",
  "timestamp": "2026-01-04T15:29:35.608Z",
  "uptime": 3446.306748682
}
```

---

### Register User

**POST** `/iam/auth/register`

Register a new user account.

**Rate Limit:** 5 requests per 15 minutes

**Request Body:**

```json
{
  "email": "user@example.com",
  "password": "password123",
  "role": "resident"
}
```

**Roles:** `resident`, `building_admin`, `manager`, `provider`, `super_admin`

**Response (201):**

```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "role": "resident",
    "createdAt": "2026-01-04T15:29:35.608Z"
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Error Responses:**

- `400` - Validation error
- `409` - User already exists

---

### Login

**POST** `/iam/auth/login`

Authenticate user and receive tokens.

**Rate Limit:** 10 requests per 15 minutes

**Request Body:**

```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response (200):**

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Error Responses:**

- `400` - Validation error
- `401` - Invalid credentials

---

### Refresh Token

**POST** `/iam/auth/refresh`

Get a new access token using a refresh token.

**Rate Limit:** 20 requests per minute

**Request Body:**

```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response (200):**

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Error Responses:**

- `400` - Validation error
- `401` - Invalid or expired refresh token

---

### Logout

**POST** `/iam/auth/logout`

Invalidate a refresh token.

**Request Body:**

```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response (200):**

```json
{
  "success": true
}
```

---

### Get Current User Profile

**GET** `/iam/me`

Get the authenticated user's profile information.

**Authentication:** Required

**Response (200):**

```json
{
  "id": "uuid",
  "email": "user@example.com",
  "role": "resident",
  "createdAt": "2026-01-04T15:29:35.608Z"
}
```

**Error Responses:**

- `401` - Unauthorized
- `404` - User not found

---

## Buildings Service

**Base Path:** `/buildings`

### Health Check

**GET** `/buildings/health`

Check if the Buildings service is running.

---

### List All Buildings

**GET** `/buildings/`

Get a list of all buildings.

**Authentication:** Required  
**Authorization:** Requires `super_admin` or `manager` role

**Response (200):**

```json
{
  "buildings": [
    {
      "id": "uuid",
      "name": "Sunset Apartments",
      "address": "123 Main St, City, State 12345",
      "createdAt": "2026-01-04T15:29:35.608Z"
    }
  ]
}
```

**Error Responses:**

- `401` - Unauthorized
- `403` - Forbidden (insufficient permissions)

---

### Create Building

**POST** `/buildings/`

Create a new building.

**Authentication:** Required  
**Authorization:** Requires `super_admin` or `manager` role

**Request Body:**

```json
{
  "name": "Sunset Apartments",
  "address": "123 Main St, City, State 12345"
}
```

**Response (201):**

```json
{
  "id": "uuid",
  "name": "Sunset Apartments",
  "address": "123 Main St, City, State 12345",
  "createdAt": "2026-01-04T15:29:35.608Z"
}
```

---

### Get Building by ID

**GET** `/buildings/{buildingId}`

Get details of a specific building.

**Authentication:** Required

**Path Parameters:**

- `buildingId` (UUID) - The building ID

**Response (200):**

```json
{
  "id": "uuid",
  "name": "Sunset Apartments",
  "address": "123 Main St, City, State 12345",
  "createdAt": "2026-01-04T15:29:35.608Z"
}
```

---

### List Units for Building

**GET** `/buildings/{buildingId}/units`

Get all units for a specific building.

**Authentication:** Required  
**Authorization:** Requires `building_admin` role

**Path Parameters:**

- `buildingId` (UUID) - The building ID

**Response (200):**

```json
{
  "units": [
    {
      "id": "uuid",
      "buildingId": "uuid",
      "unitNumber": "101",
      "floor": 1,
      "createdAt": "2026-01-04T15:29:35.608Z"
    }
  ]
}
```

---

### Bulk Create Units

**POST** `/buildings/{buildingId}/units`

Create multiple units for a building.

**Authentication:** Required  
**Authorization:** Requires `building_admin`, `super_admin`, or `manager` role

**Path Parameters:**

- `buildingId` (UUID) - The building ID

**Request Body:**

```json
{
  "units": [
    {
      "unitNumber": "101",
      "floor": 1
    },
    {
      "unitNumber": "102",
      "floor": 1
    }
  ]
}
```

**Response (201):**

```json
{
  "units": [
    {
      "id": "uuid",
      "buildingId": "uuid",
      "unitNumber": "101",
      "floor": 1,
      "createdAt": "2026-01-04T15:29:35.608Z"
    }
  ]
}
```

---

### Assign User to Unit

**POST** `/buildings/{buildingId}/memberships`

Create a membership assigning a user to a unit.

**Authentication:** Required  
**Authorization:** Requires `building_admin`, `super_admin`, or `manager` role

**Path Parameters:**

- `buildingId` (UUID) - The building ID

**Request Body:**

```json
{
  "unitId": "uuid",
  "userId": "uuid",
  "status": "verified",
  "roleInBuilding": "resident"
}
```

**Status Values:** `pending`, `verified`, `rejected`  
**Role Values:** `resident`, `admin`

**Response (201):**

```json
{
  "id": "uuid",
  "buildingId": "uuid",
  "unitId": "uuid",
  "userId": "uuid",
  "status": "verified",
  "roleInBuilding": "resident",
  "createdAt": "2026-01-04T15:29:35.608Z",
  "verifiedAt": "2026-01-04T15:29:35.608Z"
}
```

---

### Get Pending Memberships

**GET** `/buildings/{buildingId}/memberships/pending`

Get all pending membership requests for a building.

**Authentication:** Required  
**Authorization:** Requires `building_admin` role

**Path Parameters:**

- `buildingId` (UUID) - The building ID

**Response (200):**

```json
{
  "memberships": [
    {
      "id": "uuid",
      "buildingId": "uuid",
      "unitId": "uuid",
      "userId": "uuid",
      "status": "pending",
      "roleInBuilding": "resident",
      "createdAt": "2026-01-04T15:29:35.608Z",
      "verifiedAt": null
    }
  ]
}
```

---

### Verify Pending Membership

**PATCH** `/buildings/{buildingId}/memberships/{membershipId}/verify`

Verify a pending membership request.

**Authentication:** Required  
**Authorization:** Requires `building_admin` role

**Path Parameters:**

- `buildingId` (UUID) - The building ID
- `membershipId` (UUID) - The membership ID

**Response (200):**

```json
{
  "id": "uuid",
  "buildingId": "uuid",
  "unitId": "uuid",
  "userId": "uuid",
  "status": "verified",
  "roleInBuilding": "resident",
  "createdAt": "2026-01-04T15:29:35.608Z",
  "verifiedAt": "2026-01-04T15:29:35.608Z"
}
```

---

### Request Access to Building

**POST** `/buildings/{buildingId}/request-access`

Request access to a building by creating a pending membership.

**Authentication:** Required

**Path Parameters:**

- `buildingId` (UUID) - The building ID

**Request Body:**

```json
{
  "unitId": "uuid"
}
```

**Response (201):**

```json
{
  "id": "uuid",
  "buildingId": "uuid",
  "unitId": "uuid",
  "userId": "uuid",
  "status": "pending",
  "roleInBuilding": "resident",
  "createdAt": "2026-01-04T15:29:35.608Z",
  "verifiedAt": null
}
```

---

### Get My Membership Status

**GET** `/buildings/{buildingId}/me`

Get the current user's membership status for a specific building.

**Authentication:** Required

**Path Parameters:**

- `buildingId` (UUID) - The building ID

**Response (200):**

```json
{
  "id": "uuid",
  "buildingId": "uuid",
  "unitId": "uuid",
  "userId": "uuid",
  "status": "verified",
  "roleInBuilding": "resident",
  "createdAt": "2026-01-04T15:29:35.608Z",
  "verifiedAt": "2026-01-04T15:29:35.608Z"
}
```

---

## Community Service

**Base Path:** `/community`

### Health Check

**GET** `/community/health`

Check if the Community service is running.

---

### Create Post

**POST** `/community/buildings/{buildingId}/posts`

Create a new post for a building.

**Authentication:** Required  
**Authorization:** Requires verified member status

**Path Parameters:**

- `buildingId` (UUID) - The building ID

**Request Body:**

```json
{
  "title": "Community BBQ this weekend",
  "content": "Join us for a community BBQ this Saturday at 2 PM in the courtyard!"
}
```

**Response (201):**

```json
{
  "data": {
    "id": "uuid",
    "buildingId": "uuid",
    "userId": "uuid",
    "title": "Community BBQ this weekend",
    "content": "Join us for a community BBQ this Saturday at 2 PM in the courtyard!",
    "status": "active",
    "createdAt": "2026-01-04T15:29:35.608Z",
    "updatedAt": "2026-01-04T15:29:35.608Z"
  },
  "requestId": "uuid"
}
```

---

### List Posts for Building

**GET** `/community/buildings/{buildingId}/posts`

Get paginated list of posts for a building.

**Authentication:** Required  
**Authorization:** Requires verified member status

**Path Parameters:**

- `buildingId` (UUID) - The building ID

**Query Parameters:**

- `limit` (integer, default: 50, max: 100) - Maximum number of posts to return
- `offset` (integer, default: 0) - Number of posts to skip

**Response (200):**

```json
{
  "data": [
    {
      "id": "uuid",
      "buildingId": "uuid",
      "userId": "uuid",
      "title": "Community BBQ this weekend",
      "content": "Join us for a community BBQ...",
      "status": "active",
      "createdAt": "2026-01-04T15:29:35.608Z",
      "updatedAt": "2026-01-04T15:29:35.608Z"
    }
  ],
  "requestId": "uuid"
}
```

---

### Get Post by ID

**GET** `/community/posts/{postId}`

Get a specific post by its ID.

**Authentication:** Required  
**Authorization:** User must be a verified member of the post's building

**Path Parameters:**

- `postId` (UUID) - The post ID

**Response (200):**

```json
{
  "data": {
    "id": "uuid",
    "buildingId": "uuid",
    "userId": "uuid",
    "title": "Community BBQ this weekend",
    "content": "Join us for a community BBQ...",
    "status": "active",
    "createdAt": "2026-01-04T15:29:35.608Z",
    "updatedAt": "2026-01-04T15:29:35.608Z"
  },
  "requestId": "uuid"
}
```

---

### Create Comment

**POST** `/community/posts/{postId}/comments`

Create a comment on a post.

**Authentication:** Required  
**Authorization:** User must be a verified member of the post's building

**Path Parameters:**

- `postId` (UUID) - The post ID

**Request Body:**

```json
{
  "content": "Looking forward to it!"
}
```

**Response (201):**

```json
{
  "data": {
    "id": "uuid",
    "postId": "uuid",
    "userId": "uuid",
    "content": "Looking forward to it!",
    "status": "active",
    "createdAt": "2026-01-04T15:29:35.608Z",
    "updatedAt": "2026-01-04T15:29:35.608Z"
  },
  "requestId": "uuid"
}
```

---

### List Comments for Post

**GET** `/community/posts/{postId}/comments`

Get paginated list of comments for a post.

**Authentication:** Required  
**Authorization:** User must be a verified member of the post's building

**Path Parameters:**

- `postId` (UUID) - The post ID

**Query Parameters:**

- `limit` (integer, default: 50, max: 100) - Maximum number of comments to return
- `offset` (integer, default: 0) - Number of comments to skip

**Response (200):**

```json
{
  "data": [
    {
      "id": "uuid",
      "postId": "uuid",
      "userId": "uuid",
      "content": "Looking forward to it!",
      "status": "active",
      "createdAt": "2026-01-04T15:29:35.608Z",
      "updatedAt": "2026-01-04T15:29:35.608Z"
    }
  ],
  "requestId": "uuid"
}
```

---

## Tickets Service

**Base Path:** `/tickets`

### Health Check

**GET** `/tickets/health`

Check if the Tickets service is running.

---

### Create Ticket

**POST** `/tickets/buildings/{buildingId}/tickets`

Create a new ticket for a building.

**Authentication:** Required  
**Authorization:** Requires verified resident status

**Path Parameters:**

- `buildingId` (UUID) - The building ID

**Request Body:**

```json
{
  "title": "Leaky faucet in unit 101",
  "description": "The faucet in the kitchen is leaking water continuously",
  "category": "repair",
  "priority": "medium"
}
```

**Category Values:** `maintenance`, `repair`, `complaint`, `other`  
**Priority Values:** `low`, `medium`, `high`, `urgent`

**Response (201):**

```json
{
  "id": "uuid",
  "buildingId": "uuid",
  "unitId": "uuid",
  "createdByUserId": "uuid",
  "title": "Leaky faucet in unit 101",
  "description": "The faucet in the kitchen is leaking water continuously",
  "category": "repair",
  "priority": "medium",
  "status": "open",
  "assignedToUserId": null,
  "createdAt": "2026-01-04T15:29:35.608Z",
  "updatedAt": "2026-01-04T15:29:35.608Z"
}
```

---

### List Tickets for Building

**GET** `/tickets/buildings/{buildingId}/tickets`

Get paginated list of tickets for a building.

**Authentication:** Required  
**Authorization:** Admins see all tickets, residents see only their own tickets

**Path Parameters:**

- `buildingId` (UUID) - The building ID

**Query Parameters:**

- `limit` (integer, default: 50, max: 100) - Maximum number of tickets to return
- `offset` (integer, default: 0) - Number of tickets to skip
- `status` (string, optional) - Filter by status: `open`, `in_progress`, `resolved`, `closed`

**Response (200):**

```json
{
  "tickets": [
    {
      "id": "uuid",
      "buildingId": "uuid",
      "unitId": "uuid",
      "createdByUserId": "uuid",
      "title": "Leaky faucet in unit 101",
      "description": "The faucet in the kitchen...",
      "category": "repair",
      "priority": "medium",
      "status": "open",
      "assignedToUserId": null,
      "createdAt": "2026-01-04T15:29:35.608Z",
      "updatedAt": "2026-01-04T15:29:35.608Z"
    }
  ],
  "pagination": {
    "limit": 50,
    "offset": 0,
    "total": 10
  }
}
```

---

### Get Ticket by ID

**GET** `/tickets/tickets/{ticketId}`

Get a specific ticket by its ID.

**Authentication:** Required  
**Authorization:** Admins can access any ticket in their building, residents can only access tickets they created

**Path Parameters:**

- `ticketId` (UUID) - The ticket ID

**Response (200):**

```json
{
  "id": "uuid",
  "buildingId": "uuid",
  "unitId": "uuid",
  "createdByUserId": "uuid",
  "title": "Leaky faucet in unit 101",
  "description": "The faucet in the kitchen...",
  "category": "repair",
  "priority": "medium",
  "status": "open",
  "assignedToUserId": null,
  "createdAt": "2026-01-04T15:29:35.608Z",
  "updatedAt": "2026-01-04T15:29:35.608Z"
}
```

---

### Assign Ticket

**PATCH** `/tickets/tickets/{ticketId}/assign`

Assign a ticket to a user.

**Authentication:** Required  
**Authorization:** Requires building admin role

**Path Parameters:**

- `ticketId` (UUID) - The ticket ID

**Request Body:**

```json
{
  "assignedToUserId": "uuid"
}
```

**Response (200):**

```json
{
  "id": "uuid",
  "buildingId": "uuid",
  "unitId": "uuid",
  "createdByUserId": "uuid",
  "title": "Leaky faucet in unit 101",
  "description": "The faucet in the kitchen...",
  "category": "repair",
  "priority": "medium",
  "status": "open",
  "assignedToUserId": "uuid",
  "createdAt": "2026-01-04T15:29:35.608Z",
  "updatedAt": "2026-01-04T15:29:35.608Z"
}
```

---

### Change Ticket Status

**PATCH** `/tickets/tickets/{ticketId}/status`

Update the status of a ticket.

**Authentication:** Required  
**Authorization:** Requires building admin role

**Path Parameters:**

- `ticketId` (UUID) - The ticket ID

**Request Body:**

```json
{
  "status": "in_progress"
}
```

**Status Values:** `open`, `in_progress`, `resolved`, `closed`

**Response (200):**

```json
{
  "id": "uuid",
  "buildingId": "uuid",
  "unitId": "uuid",
  "createdByUserId": "uuid",
  "title": "Leaky faucet in unit 101",
  "description": "The faucet in the kitchen...",
  "category": "repair",
  "priority": "medium",
  "status": "in_progress",
  "assignedToUserId": "uuid",
  "createdAt": "2026-01-04T15:29:35.608Z",
  "updatedAt": "2026-01-04T15:29:35.608Z"
}
```

---

## Notifications Service

**Base Path:** `/notifications`

### Health Check

**GET** `/notifications/health`

Check if the Notifications service is running.

---

### List User Notifications

**GET** `/notifications/`

Get paginated list of notifications for the authenticated user.

**Authentication:** Required

**Query Parameters:**

- `limit` (integer, default: 50, max: 100) - Maximum number of notifications to return
- `offset` (integer, default: 0) - Number of notifications to skip

**Response (200):**

```json
{
  "notifications": [
    {
      "id": "uuid",
      "userId": "uuid",
      "type": "ticket_created",
      "title": "New ticket created",
      "body": "A new ticket has been created in your building",
      "data": {},
      "readAt": null,
      "createdAt": "2026-01-04T15:29:35.608Z"
    }
  ],
  "pagination": {
    "limit": 50,
    "offset": 0,
    "total": 10
  }
}
```

---

### Get Notification by ID

**GET** `/notifications/{id}`

Get a specific notification by its ID.

**Authentication:** Required  
**Authorization:** Users can only access their own notifications

**Path Parameters:**

- `id` (UUID) - The notification ID

**Response (200):**

```json
{
  "id": "uuid",
  "userId": "uuid",
  "type": "ticket_created",
  "title": "New ticket created",
  "body": "A new ticket has been created in your building",
  "data": {},
  "readAt": null,
  "createdAt": "2026-01-04T15:29:35.608Z"
}
```

---

### Mark Notification as Read

**PATCH** `/notifications/{id}/read`

Mark a notification as read.

**Authentication:** Required

**Path Parameters:**

- `id` (UUID) - The notification ID

**Response (200):**

```json
{
  "id": "uuid",
  "userId": "uuid",
  "type": "ticket_created",
  "title": "New ticket created",
  "body": "A new ticket has been created in your building",
  "data": {},
  "readAt": "2026-01-04T15:29:35.608Z",
  "createdAt": "2026-01-04T15:29:35.608Z"
}
```

---

## Access Service

**Base Path:** `/access`

### Health Check

**GET** `/access/health`

Check if the Access service is running.

---

### Create Visitor Pass

**POST** `/access/buildings/{buildingId}/visitor-passes`

Create a new visitor pass for a building.

**Authentication:** Required  
**Authorization:** Requires verified resident membership

**Path Parameters:**

- `buildingId` (UUID) - The building ID

**Request Body:**

```json
{
  "visitorName": "John Doe",
  "validFrom": "2024-01-15T10:00:00Z",
  "validTo": "2024-01-15T18:00:00Z"
}
```

**Response (201):**

```json
{
  "id": "uuid",
  "buildingId": "uuid",
  "residentId": "uuid",
  "visitorName": "John Doe",
  "validFrom": "2024-01-15T10:00:00Z",
  "validTo": "2024-01-15T18:00:00Z",
  "status": "active",
  "createdAt": "2026-01-04T15:29:35.608Z"
}
```

---

### List My Visitor Passes

**GET** `/access/buildings/{buildingId}/visitor-passes`

Get a list of visitor passes for the authenticated resident in a building.

**Authentication:** Required  
**Authorization:** Requires verified resident membership

**Path Parameters:**

- `buildingId` (UUID) - The building ID

**Query Parameters:**

- `status` (string, optional) - Filter by status: `active`, `used`, `revoked`
- `limit` (integer, default: 50, max: 100) - Maximum number of passes to return
- `offset` (integer, default: 0) - Number of passes to skip

**Response (200):**

```json
{
  "visitorPasses": [
    {
      "id": "uuid",
      "buildingId": "uuid",
      "residentId": "uuid",
      "visitorName": "John Doe",
      "validFrom": "2024-01-15T10:00:00Z",
      "validTo": "2024-01-15T18:00:00Z",
      "status": "active",
      "createdAt": "2026-01-04T15:29:35.608Z"
    }
  ],
  "pagination": {
    "limit": 50,
    "offset": 0,
    "total": 5
  }
}
```

---

### Revoke Visitor Pass

**PATCH** `/access/visitor-passes/{id}/revoke`

Revoke a visitor pass. Only the owner can revoke, and only if status is 'active'.

**Authentication:** Required  
**Authorization:** User must own the visitor pass

**Path Parameters:**

- `id` (UUID) - The visitor pass ID

**Response (200):**

```json
{
  "id": "uuid",
  "buildingId": "uuid",
  "residentId": "uuid",
  "visitorName": "John Doe",
  "validFrom": "2024-01-15T10:00:00Z",
  "validTo": "2024-01-15T18:00:00Z",
  "status": "revoked",
  "createdAt": "2026-01-04T15:29:35.608Z"
}
```

**Error Responses:**

- `400` - Invalid visitor pass ID format or pass is not active
- `403` - User does not own this visitor pass
- `404` - Visitor pass not found
- `409` - Pass cannot be revoked (already used or revoked)

---

### Mark Visitor Pass as Used

**PATCH** `/access/visitor-passes/{id}/mark-used`

Mark a visitor pass as used. Only admin or guard can mark as used.

**Authentication:** Required  
**Authorization:** Requires admin or guard role

**Path Parameters:**

- `id` (UUID) - The visitor pass ID

**Response (200):**

```json
{
  "id": "uuid",
  "buildingId": "uuid",
  "residentId": "uuid",
  "visitorName": "John Doe",
  "validFrom": "2024-01-15T10:00:00Z",
  "validTo": "2024-01-15T18:00:00Z",
  "status": "used",
  "createdAt": "2026-01-04T15:29:35.608Z"
}
```

**Error Responses:**

- `400` - Invalid visitor pass ID format or pass is not valid at this time
- `403` - User is not an admin or guard
- `404` - Visitor pass not found
- `409` - Pass cannot be marked as used (already used, revoked, or outside valid time window)

---

## Error Handling

All endpoints return errors in a consistent format:

```json
{
  "error": {
    "message": "Error description",
    "code": "ERROR_CODE",
    "statusCode": 400,
    "details": {}
  },
  "requestId": "uuid",
  "timestamp": "2026-01-04T15:29:35.608Z",
  "path": "/api/endpoint"
}
```

### Common HTTP Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request (validation error)
- `401` - Unauthorized (invalid or missing token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `409` - Conflict (resource already exists or invalid state)
- `500` - Internal Server Error

---

## Authentication & Authorization

### User Roles

- **resident** - Basic user, can create tickets, posts, visitor passes
- **building_admin** - Can manage their building (units, memberships, tickets)
- **manager** - Platform-level admin, can manage multiple buildings
- **provider** - Service provider, can be assigned tickets
- **super_admin** - Full platform access

### Authentication Flow

1. **Register** or **Login** to receive `accessToken` and `refreshToken`
2. Include `accessToken` in the `Authorization` header for protected endpoints:
   ```
   Authorization: Bearer <access_token>
   ```
3. When `accessToken` expires, use **Refresh Token** endpoint to get a new `accessToken`
4. Use **Logout** endpoint to invalidate the `refreshToken`

### Rate Limiting

- **Register:** 5 requests per 15 minutes
- **Login:** 10 requests per 15 minutes
- **Refresh Token:** 20 requests per minute

---

## Swagger Documentation

Each service provides interactive Swagger UI documentation:

- IAM: `https://techgazzeta.com/iam/docs`
- Buildings: `https://techgazzeta.com/buildings/docs`
- Community: `https://techgazzeta.com/community/docs`
- Tickets: `https://techgazzeta.com/tickets/docs`
- Notifications: `https://techgazzeta.com/notifications/docs`
- Access: `https://techgazzeta.com/access/docs`

---

**Document Version:** 1.0  
**Last Updated:** January 2026  
**Base URL:** `https://techgazzeta.com`
