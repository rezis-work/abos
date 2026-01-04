import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'crypto';
import { api, authenticatedApi } from '../helpers/http';
import { makeResidentToken, makeGuardToken, makeAdminToken } from '../helpers/jwt';
import { publishResidentVerified, closeRabbitMQ } from '../helpers/rabbit';
import { waitFor } from '../helpers/wait';
import {
  getVisitorPass,
  getVisitorPassEvents,
  getOutboxEvents,
  getMembershipProjection,
  closeDb,
} from '../helpers/db';

describe('Access Service - Visitor Passes Integration', () => {
  // Test data
  const residentId = randomUUID();
  const otherResidentId = randomUUID();
  const guardId = randomUUID();
  const adminId = randomUUID();
  const buildingId = randomUUID();
  const unitId = randomUUID();

  beforeAll(async () => {
    // Ensure services are running (health check)
    const healthResponse = await api('/access/health');
    expect(healthResponse.status).toBe(200);
  });

  afterAll(async () => {
    // Cleanup connections
    await closeRabbitMQ();
    await closeDb();
  });

  describe('Scenario A — Create pass (verified resident)', () => {
    it('should create a visitor pass for verified resident', async () => {
      const eventId = randomUUID();
      
      // Step 1: Publish resident.verified.v1 event
      await publishResidentVerified(
        residentId,
        buildingId,
        unitId,
        'resident',
        { eventId }
      );

      // Step 2: Wait for projection to be created
      // We'll wait by trying to create a pass until it stops returning 403
      await waitFor(
        async () => {
          const token = makeResidentToken(residentId);
          const validFrom = new Date();
          validFrom.setHours(validFrom.getHours() + 1);
          const validTo = new Date();
          validTo.setHours(validTo.getHours() + 2);

          const response = await authenticatedApi(
            `/access/buildings/${buildingId}/visitor-passes`,
            token,
            {
              method: 'POST',
              body: {
                visitorName: 'Test Visitor',
                validFrom: validFrom.toISOString(),
                validTo: validTo.toISOString(),
              },
            }
          );

          // If we get 201, projection is ready
          if (response.status === 201) {
            return response.data;
          }
          
          // If we get 403, projection not ready yet
          if (response.status === 403) {
            return null;
          }

          // Other errors should fail
          throw new Error(`Unexpected status: ${response.status}`);
        },
        {
          timeoutMs: 15000,
          intervalMs: 500,
          description: 'Membership projection to be created',
        }
      );

      // Step 3: Create visitor pass (now that projection exists)
      const token = makeResidentToken(residentId);
      const validFrom = new Date();
      validFrom.setHours(validFrom.getHours() + 1);
      const validTo = new Date();
      validTo.setHours(validTo.getHours() + 2);

      const createResponse = await authenticatedApi(
        `/access/buildings/${buildingId}/visitor-passes`,
        token,
        {
          method: 'POST',
          body: {
            visitorName: 'John Doe',
            validFrom: validFrom.toISOString(),
            validTo: validTo.toISOString(),
          },
        }
      );

      // Assert: 201 success
      expect(createResponse.status).toBe(201);
      expect(createResponse.data).toBeDefined();

      const pass = createResponse.data as any;
      expect(pass.id).toBeDefined();
      expect(pass.buildingId).toBe(buildingId);
      expect(pass.residentId).toBe(residentId);
      expect(pass.visitorName).toBe('John Doe');
      expect(pass.status).toBe('active');

      // DB asserts: row exists in visitor_passes
      const dbPass = await getVisitorPass(pass.id);
      expect(dbPass).toBeDefined();
      expect(dbPass?.status).toBe('active');

      // DB asserts: visitor_pass_events contains created
      const events = await getVisitorPassEvents(pass.id);
      expect(events.length).toBeGreaterThan(0);
      const createdEvent = events.find((e: any) => e.type === 'created');
      expect(createdEvent).toBeDefined();

      // DB asserts: outbox_events contains visitor_pass.created.v1
      const outboxEvents = await getOutboxEvents({
        eventType: 'visitor_pass.created',
        published: false, // May not be published yet
      });
      const createdOutboxEvent = outboxEvents.find(
        (e: any) => e.payload?.visitorPassId === pass.id
      );
      expect(createdOutboxEvent).toBeDefined();
      expect(createdOutboxEvent?.event_type).toBe('visitor_pass.created');
    });

    it('should reject creating pass for non-verified resident', async () => {
      const token = makeResidentToken(otherResidentId);
      const validFrom = new Date();
      validFrom.setHours(validFrom.getHours() + 1);
      const validTo = new Date();
      validTo.setHours(validTo.getHours() + 2);

      const response = await authenticatedApi(
        `/access/buildings/${buildingId}/visitor-passes`,
        token,
        {
          method: 'POST',
          body: {
            visitorName: 'Unauthorized Visitor',
            validFrom: validFrom.toISOString(),
            validTo: validTo.toISOString(),
          },
        }
      );

      expect(response.status).toBe(403);
    });
  });

  describe('Scenario B — List my passes', () => {
    it('should list visitor passes for verified resident', async () => {
      // First, ensure resident is verified
      const eventId = randomUUID();
      await publishResidentVerified(
        residentId,
        buildingId,
        unitId,
        'resident',
        { eventId }
      );

      // Wait for projection
      await waitFor(
        async () => {
          const projection = await getMembershipProjection(residentId, buildingId);
          return projection ? true : null;
        },
        { timeoutMs: 10000, intervalMs: 500 }
      );

      // Create a pass first
      const token = makeResidentToken(residentId);
      const validFrom = new Date();
      validFrom.setHours(validFrom.getHours() + 1);
      const validTo = new Date();
      validTo.setHours(validTo.getHours() + 2);

      const createResponse = await authenticatedApi(
        `/access/buildings/${buildingId}/visitor-passes`,
        token,
        {
          method: 'POST',
          body: {
            visitorName: 'List Test Visitor',
            validFrom: validFrom.toISOString(),
            validTo: validTo.toISOString(),
          },
        }
      );

      expect(createResponse.status).toBe(201);
      const createdPass = createResponse.data as any;

      // Now list passes
      const listResponse = await authenticatedApi(
        `/access/buildings/${buildingId}/my-visitor-passes`,
        token
      );

      expect(listResponse.status).toBe(200);
      const listData = listResponse.data as any;
      expect(listData.visitorPasses).toBeDefined();
      expect(Array.isArray(listData.visitorPasses)).toBe(true);
      expect(listData.visitorPasses.length).toBeGreaterThan(0);

      // Verify the created pass is in the list
      const foundPass = listData.visitorPasses.find(
        (p: any) => p.id === createdPass.id
      );
      expect(foundPass).toBeDefined();
    });
  });

  describe('Scenario C — Revoke (owner only)', () => {
    it('should revoke visitor pass (owner only)', async () => {
      // Ensure resident is verified
      const eventId = randomUUID();
      await publishResidentVerified(
        residentId,
        buildingId,
        unitId,
        'resident',
        { eventId }
      );

      await waitFor(
        async () => {
          const projection = await getMembershipProjection(residentId, buildingId);
          return projection ? true : null;
        },
        { timeoutMs: 10000, intervalMs: 500 }
      );

      // Create a pass
      const token = makeResidentToken(residentId);
      const validFrom = new Date();
      validFrom.setHours(validFrom.getHours() + 1);
      const validTo = new Date();
      validTo.setHours(validTo.getHours() + 2);

      const createResponse = await authenticatedApi(
        `/access/buildings/${buildingId}/visitor-passes`,
        token,
        {
          method: 'POST',
          body: {
            visitorName: 'Revoke Test Visitor',
            validFrom: validFrom.toISOString(),
            validTo: validTo.toISOString(),
          },
        }
      );

      expect(createResponse.status).toBe(201);
      const pass = createResponse.data as any;

      // Revoke the pass
      const revokeResponse = await authenticatedApi(
        `/access/visitor-passes/${pass.id}/revoke`,
        token,
        {
          method: 'PATCH',
        }
      );

      expect(revokeResponse.status).toBe(200);
      const revokedPass = revokeResponse.data as any;
      expect(revokedPass.status).toBe('revoked');

      // DB asserts: status is revoked
      const dbPass = await getVisitorPass(pass.id);
      expect(dbPass?.status).toBe('revoked');

      // DB asserts: outbox contains visitor_pass.revoked.v1
      const outboxEvents = await getOutboxEvents({
        eventType: 'visitor_pass.revoked',
      });
      const revokedOutboxEvent = outboxEvents.find(
        (e: any) => e.payload?.visitorPassId === pass.id
      );
      expect(revokedOutboxEvent).toBeDefined();
    });

    it('should reject revoke from another user', async () => {
      // Ensure both residents are verified
      await publishResidentVerified(
        residentId,
        buildingId,
        unitId,
        'resident',
        { eventId: randomUUID() }
      );
      await publishResidentVerified(
        otherResidentId,
        buildingId,
        unitId,
        'resident',
        { eventId: randomUUID() }
      );

      await waitFor(
        async () => {
          const projection = await getMembershipProjection(residentId, buildingId);
          return projection ? true : null;
        },
        { timeoutMs: 10000, intervalMs: 500 }
      );

      // Create a pass as residentId
      const ownerToken = makeResidentToken(residentId);
      const validFrom = new Date();
      validFrom.setHours(validFrom.getHours() + 1);
      const validTo = new Date();
      validTo.setHours(validTo.getHours() + 2);

      const createResponse = await authenticatedApi(
        `/access/buildings/${buildingId}/visitor-passes`,
        ownerToken,
        {
          method: 'POST',
          body: {
            visitorName: 'Protected Visitor',
            validFrom: validFrom.toISOString(),
            validTo: validTo.toISOString(),
          },
        }
      );

      expect(createResponse.status).toBe(201);
      const pass = createResponse.data as any;

      // Try to revoke as otherResidentId
      const otherToken = makeResidentToken(otherResidentId);
      const revokeResponse = await authenticatedApi(
        `/access/visitor-passes/${pass.id}/revoke`,
        otherToken,
        {
          method: 'PATCH',
        }
      );

      expect(revokeResponse.status).toBe(403);
    });
  });

  describe('Scenario D — Mark used (admin/guard)', () => {
    it('should mark visitor pass as used (admin/guard only)', async () => {
      // Ensure resident is verified
      await publishResidentVerified(
        residentId,
        buildingId,
        unitId,
        'resident',
        { eventId: randomUUID() }
      );

      await waitFor(
        async () => {
          const projection = await getMembershipProjection(residentId, buildingId);
          return projection ? true : null;
        },
        { timeoutMs: 10000, intervalMs: 500 }
      );

      // Create a pass
      const token = makeResidentToken(residentId);
      const validFrom = new Date();
      validFrom.setMinutes(validFrom.getMinutes() - 30); // Valid from 30 mins ago
      const validTo = new Date();
      validTo.setHours(validTo.getHours() + 2); // Valid for 2 more hours

      const createResponse = await authenticatedApi(
        `/access/buildings/${buildingId}/visitor-passes`,
        token,
        {
          method: 'POST',
          body: {
            visitorName: 'Used Test Visitor',
            validFrom: validFrom.toISOString(),
            validTo: validTo.toISOString(),
          },
        }
      );

      expect(createResponse.status).toBe(201);
      const pass = createResponse.data as any;

      // Mark as used as guard
      const guardToken = makeGuardToken(guardId);
      const markUsedResponse = await authenticatedApi(
        `/access/visitor-passes/${pass.id}/mark-used`,
        guardToken,
        {
          method: 'PATCH',
        }
      );

      expect(markUsedResponse.status).toBe(200);
      const usedPass = markUsedResponse.data as any;
      expect(usedPass.status).toBe('used');

      // DB asserts: status is used
      const dbPass = await getVisitorPass(pass.id);
      expect(dbPass?.status).toBe('used');

      // DB asserts: outbox contains visitor_pass.used.v1
      const outboxEvents = await getOutboxEvents({
        eventType: 'visitor_pass.used',
      });
      const usedOutboxEvent = outboxEvents.find(
        (e: any) => e.payload?.visitorPassId === pass.id
      );
      expect(usedOutboxEvent).toBeDefined();

      // DB asserts: outbox contains notification.send.v1 for residentId
      const notificationEvents = await getOutboxEvents({
        eventType: 'notification.send',
      });
      const notificationEvent = notificationEvents.find(
        (e: any) => e.payload?.userId === residentId
      );
      expect(notificationEvent).toBeDefined();
      expect(notificationEvent?.payload?.type).toBe('visitor_pass_used');
    });

    it('should reject mark-used from resident', async () => {
      // Ensure resident is verified
      await publishResidentVerified(
        residentId,
        buildingId,
        unitId,
        'resident',
        { eventId: randomUUID() }
      );

      await waitFor(
        async () => {
          const projection = await getMembershipProjection(residentId, buildingId);
          return projection ? true : null;
        },
        { timeoutMs: 10000, intervalMs: 500 }
      );

      // Create a pass
      const token = makeResidentToken(residentId);
      const validFrom = new Date();
      validFrom.setMinutes(validFrom.getMinutes() - 30);
      const validTo = new Date();
      validTo.setHours(validTo.getHours() + 2);

      const createResponse = await authenticatedApi(
        `/access/buildings/${buildingId}/visitor-passes`,
        token,
        {
          method: 'POST',
          body: {
            visitorName: 'Protected Visitor',
            validFrom: validFrom.toISOString(),
            validTo: validTo.toISOString(),
          },
        }
      );

      expect(createResponse.status).toBe(201);
      const pass = createResponse.data as any;

      // Try to mark as used as resident
      const markUsedResponse = await authenticatedApi(
        `/access/visitor-passes/${pass.id}/mark-used`,
        token,
        {
          method: 'PATCH',
        }
      );

      expect(markUsedResponse.status).toBe(403);
    });

    it('should reject mark-used on revoked pass', async () => {
      // Ensure resident is verified
      await publishResidentVerified(
        residentId,
        buildingId,
        unitId,
        'resident',
        { eventId: randomUUID() }
      );

      await waitFor(
        async () => {
          const projection = await getMembershipProjection(residentId, buildingId);
          return projection ? true : null;
        },
        { timeoutMs: 10000, intervalMs: 500 }
      );

      // Create and revoke a pass
      const token = makeResidentToken(residentId);
      const validFrom = new Date();
      validFrom.setMinutes(validFrom.getMinutes() - 30);
      const validTo = new Date();
      validTo.setHours(validTo.getHours() + 2);

      const createResponse = await authenticatedApi(
        `/access/buildings/${buildingId}/visitor-passes`,
        token,
        {
          method: 'POST',
          body: {
            visitorName: 'Revoked Visitor',
            validFrom: validFrom.toISOString(),
            validTo: validTo.toISOString(),
          },
        }
      );

      expect(createResponse.status).toBe(201);
      const pass = createResponse.data as any;

      // Revoke it
      await authenticatedApi(`/access/visitor-passes/${pass.id}/revoke`, token, {
        method: 'PATCH',
      });

      // Try to mark as used
      const guardToken = makeGuardToken(guardId);
      const markUsedResponse = await authenticatedApi(
        `/access/visitor-passes/${pass.id}/mark-used`,
        guardToken,
        {
          method: 'PATCH',
        }
      );

      expect(markUsedResponse.status).toBe(409);
    });

    it('should reject mark-used when outside valid time window', async () => {
      // Ensure resident is verified
      await publishResidentVerified(
        residentId,
        buildingId,
        unitId,
        'resident',
        { eventId: randomUUID() }
      );

      await waitFor(
        async () => {
          const projection = await getMembershipProjection(residentId, buildingId);
          return projection ? true : null;
        },
        { timeoutMs: 10000, intervalMs: 500 }
      );

      // Create a pass that's already expired
      const token = makeResidentToken(residentId);
      const validFrom = new Date();
      validFrom.setHours(validFrom.getHours() - 3); // Started 3 hours ago
      const validTo = new Date();
      validTo.setHours(validTo.getHours() - 1); // Ended 1 hour ago

      const createResponse = await authenticatedApi(
        `/access/buildings/${buildingId}/visitor-passes`,
        token,
        {
          method: 'POST',
          body: {
            visitorName: 'Expired Visitor',
            validFrom: validFrom.toISOString(),
            validTo: validTo.toISOString(),
          },
        }
      );

      expect(createResponse.status).toBe(201);
      const pass = createResponse.data as any;

      // Try to mark as used (should fail - outside time window)
      const guardToken = makeGuardToken(guardId);
      const markUsedResponse = await authenticatedApi(
        `/access/visitor-passes/${pass.id}/mark-used`,
        guardToken,
        {
          method: 'PATCH',
        }
      );

      expect(markUsedResponse.status).toBe(409);
    });
  });
});
