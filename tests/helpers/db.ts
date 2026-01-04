/**
 * Database helper for integration tests
 * Connects to postgres-test for access_db
 */

import postgres from 'postgres';

const DATABASE_URL =
  process.env.TEST_DATABASE_URL ||
  'postgresql://test:test@localhost:5433/access_db';

let sql: ReturnType<typeof postgres> | null = null;

/**
 * Get database connection
 */
function getDb() {
  if (!sql) {
    sql = postgres(DATABASE_URL, {
      max: 1, // Single connection for tests
    });
  }
  return sql;
}

/**
 * Query visitor passes
 */
export async function getVisitorPass(passId: string) {
  const db = getDb();
  const [pass] = await db`
    SELECT * FROM visitor_passes WHERE id = ${passId}
  `;
  return pass || null;
}

/**
 * Query visitor pass events
 */
export async function getVisitorPassEvents(passId: string) {
  const db = getDb();
  return await db`
    SELECT * FROM visitor_pass_events 
    WHERE visitor_pass_id = ${passId}
    ORDER BY created_at ASC
  `;
}

/**
 * Query outbox events
 */
export async function getOutboxEvents(filters?: {
  eventType?: string;
  published?: boolean;
  limit?: number;
}) {
  const db = getDb();
  let query = db`SELECT * FROM outbox_events WHERE 1=1`;
  
  if (filters?.eventType) {
    query = db`${query} AND event_type = ${filters.eventType}`;
  }
  
  if (filters?.published !== undefined) {
    query = db`${query} AND published = ${filters.published}`;
  }
  
  query = db`${query} ORDER BY created_at DESC`;
  
  if (filters?.limit) {
    query = db`${query} LIMIT ${filters.limit}`;
  }
  
  return await query;
}

/**
 * Query membership projection
 */
export async function getMembershipProjection(userId: string, buildingId: string) {
  const db = getDb();
  const [projection] = await db`
    SELECT * FROM building_memberships_projection
    WHERE user_id = ${userId} AND building_id = ${buildingId}
  `;
  return projection || null;
}

/**
 * Query processed events (for idempotency verification)
 */
export async function getProcessedEvent(eventId: string) {
  const db = getDb();
  const [event] = await db`
    SELECT * FROM processed_events WHERE event_id = ${eventId}
  `;
  return event || null;
}

/**
 * Close database connection
 */
export async function closeDb(): Promise<void> {
  if (sql) {
    await sql.end();
    sql = null;
  }
}

