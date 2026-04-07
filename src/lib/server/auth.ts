// ABOUTME: JWT authentication utilities — sign, verify, password hashing, request user extraction.
// ABOUTME: Uses HMAC-SHA256 for JWT (matching existing backend) and bcrypt for passwords.

import { createHmac } from 'crypto';
import bcrypt from 'bcrypt';
import { prisma } from '@/lib/server/db';

interface UserPayload {
  sub: string;
  username: string;
  exp: number;
  iat: number;
}

export interface UserProfile {
  id: string;
  username: string;
  displayName: string;
}

const JWT_SECRET = process.env.JWT_SECRET ?? 'cadiro-dev-secret-change-in-production';
const TOKEN_TTL = 86400; // 24 hours
const BCRYPT_ROUNDS = 10;

function base64UrlEncode(data: string): string {
  return Buffer.from(data).toString('base64url');
}

function base64UrlDecode(data: string): string {
  return Buffer.from(data, 'base64url').toString('utf-8');
}

export function signToken(userId: string, username: string): string {
  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = base64UrlEncode(
    JSON.stringify({ sub: userId, username, iat: now, exp: now + TOKEN_TTL }),
  );
  const signature = createHmac('sha256', JWT_SECRET)
    .update(`${header}.${payload}`)
    .digest('base64url');
  return `${header}.${payload}.${signature}`;
}

export function verifyToken(token: string): UserPayload | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [header, payload, signature] = parts;
  const expected = createHmac('sha256', JWT_SECRET)
    .update(`${header}.${payload}`)
    .digest('base64url');

  if (signature !== expected) return null;

  try {
    const decoded = JSON.parse(base64UrlDecode(payload)) as UserPayload;
    if (decoded.exp < Math.floor(Date.now() / 1000)) return null;
    return decoded;
  } catch {
    return null;
  }
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Extracts and validates the authenticated user from a request's Authorization header.
 * Returns null if no valid token or user not found.
 */
export async function getAuthUser(request: Request): Promise<UserProfile | null> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  const token = authHeader.slice(7);
  const payload = verifyToken(token);
  if (!payload) return null;

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: { id: true, username: true, displayName: true },
  });

  return user;
}

/**
 * Requires authentication — returns user or throws.
 * Use in route handlers: `const user = await requireAuth(request);`
 */
export async function requireAuth(request: Request): Promise<UserProfile> {
  const user = await getAuthUser(request);
  if (!user) {
    throw new AuthError('Authentication required', 401);
  }
  return user;
}

export class AuthError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'AuthError';
    this.status = status;
  }
}
