import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { getEnv } from '@common/env';

const env = getEnv();
const JWT_SECRET = (env.JWT_SECRET || 'change-me-in-production') as string;
const ACCESS_TOKEN_EXPIRY = (env.JWT_ACCESS_TOKEN_EXPIRY || '15m') as string;

export interface TokenPayload {
  userId: string;
  role: string;
}

export function generateAccessToken(userId: string, role: string): string {
  const payload: TokenPayload = { userId, role };
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRY,
  } as jwt.SignOptions);
}

export function generateRefreshToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function verifyAccessToken(token: string): TokenPayload {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as TokenPayload;
    return decoded;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error('Token expired');
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new Error('Invalid token');
    }
    throw error;
  }
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

