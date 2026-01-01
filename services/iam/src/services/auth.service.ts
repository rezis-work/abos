import { eq, and, gt, isNull } from 'drizzle-orm';
import { db, users, refreshTokens, outboxEvents, type User } from '../db';
import { hashPassword, comparePassword } from '../utils/password';
import { generateAccessToken, generateRefreshToken, hashToken } from './token.service';
import { createEventId } from '@common/events';
import { getEnv } from '@common/env';

const env = getEnv();
const REFRESH_TOKEN_EXPIRY_DAYS = parseInt(env.REFRESH_TOKEN_EXPIRY?.replace('d', '') || '7');

export interface RegisterResult {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
}

export async function register(
  email: string,
  password: string,
  role: string = 'resident',
  correlationId?: string
): Promise<RegisterResult> {
  // Check if user already exists
  const existingUser = await db.select().from(users).where(eq(users.email, email)).limit(1);
  
  if (existingUser.length > 0) {
    throw new Error('User with this email already exists');
  }

  // Hash password
  const passwordHash = await hashPassword(password);

  // Generate tokens
  const refreshToken = generateRefreshToken();
  const refreshTokenHash = hashToken(refreshToken);

  // Calculate expiry
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);

  // Create event ID
  const eventId = await createEventId();

  // Use transaction to ensure atomicity
  const result = await db.transaction(async (tx) => {
    // Insert user
    const [newUser] = await tx
      .insert(users)
      .values({
        email,
        passwordHash,
        role: role as any,
      })
      .returning();

    // Insert refresh token
    await tx.insert(refreshTokens).values({
      userId: newUser.id,
      tokenHash: refreshTokenHash,
      expiresAt,
    });

    // Insert outbox event with correlation ID
    await tx.insert(outboxEvents).values({
      eventId,
      eventType: 'user.created',
      version: 'v1',
      payload: {
        userId: newUser.id,
        email: newUser.email,
        role: newUser.role,
        createdAt: newUser.createdAt.toISOString(),
        correlationId, // Store correlation ID in payload
      },
    });

    return newUser;
  });

  // Generate access token
  const accessToken = generateAccessToken(result.id, result.role);

  return {
    user: result,
    accessToken,
    refreshToken,
  };
}

export async function login(email: string, password: string): Promise<LoginResult> {
  // Find user
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);

  if (!user) {
    throw new Error('Invalid email or password');
  }

  // Verify password
  const isValid = await comparePassword(password, user.passwordHash);
  if (!isValid) {
    throw new Error('Invalid email or password');
  }

  // Generate tokens
  const refreshToken = generateRefreshToken();
  const refreshTokenHash = hashToken(refreshToken);
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);

  // Store refresh token
  await db.insert(refreshTokens).values({
    userId: user.id,
    tokenHash: refreshTokenHash,
    expiresAt,
  });

  // Generate access token
  const accessToken = generateAccessToken(user.id, user.role);

  return {
    accessToken,
    refreshToken,
  };
}

export async function refresh(refreshToken: string): Promise<{ accessToken: string }> {
  const tokenHash = hashToken(refreshToken);

  // Find refresh token
  const [token] = await db
    .select({
      token: refreshTokens,
      user: users,
    })
    .from(refreshTokens)
    .innerJoin(users, eq(refreshTokens.userId, users.id))
    .where(
      and(
        eq(refreshTokens.tokenHash, tokenHash),
        gt(refreshTokens.expiresAt, new Date()),
        isNull(refreshTokens.revokedAt)
      )
    )
    .limit(1);

  if (!token) {
    throw new Error('Invalid or expired refresh token');
  }

  // Generate new access token
  const accessToken = generateAccessToken(token.user.id, token.user.role);

  return { accessToken };
}

export async function logout(refreshToken: string): Promise<void> {
  const tokenHash = hashToken(refreshToken);

  // Revoke refresh token
  await db
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(eq(refreshTokens.tokenHash, tokenHash));
}

export async function getUserById(userId: string): Promise<User | null> {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return user || null;
}

