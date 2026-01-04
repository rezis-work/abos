/**
 * JWT helper for integration tests
 * Signs tokens using the same JWT secret used by services in test compose
 */

import jwt from 'jsonwebtoken';

// Use the same default as services - ensure both use the same secret
const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';

export interface TokenOptions {
  userId: string;
  role: string;
  expiresIn?: string;
}

/**
 * Create a JWT token for testing
 */
export function makeToken(options: TokenOptions): string {
  const { userId, role, expiresIn = '1h' } = options;
  
  const payload = {
    userId,
    role,
  };

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn,
  });
}

/**
 * Create a token for a resident user
 */
export function makeResidentToken(userId: string): string {
  return makeToken({ userId, role: 'resident' });
}

/**
 * Create a token for an admin user
 */
export function makeAdminToken(userId: string): string {
  return makeToken({ userId, role: 'super_admin' });
}

/**
 * Create a token for a guard user
 */
export function makeGuardToken(userId: string): string {
  return makeToken({ userId, role: 'guard' });
}

