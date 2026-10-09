import { createHmac, randomBytes } from 'node:crypto';
import { jwtVerify, SignJWT } from 'jose';
import { env } from '../config/env.js';
import { AppError } from '../errors/app-error.js';

const accessKey = new TextEncoder().encode(env.JWT_ACCESS_SECRET);

export interface AccessTokenPayload {
  userId: string;
}

export async function signAccessToken(userId: string): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(env.JWT_ACCESS_TTL)
    .sign(accessKey);
}

/** Throws `AppError.unauthorized` for any invalid, expired or malformed token. */
export async function verifyAccessToken(token: string): Promise<AccessTokenPayload> {
  try {
    const { payload } = await jwtVerify(token, accessKey, { algorithms: ['HS256'] });
    if (!payload.sub) throw new Error('missing subject');
    return { userId: payload.sub };
  } catch {
    throw AppError.unauthorized('Invalid or expired access token');
  }
}

/** Opaque, high-entropy refresh token. Only its hash is ever stored. */
export function generateRefreshToken(): string {
  return randomBytes(32).toString('base64url');
}

/**
 * HMAC (not a plain hash) keyed with the refresh secret, so a database leak alone is not
 * enough to confirm guesses. Deterministic, so the hash can be used as a lookup key.
 */
export function hashRefreshToken(token: string): string {
  return createHmac('sha256', env.JWT_REFRESH_SECRET).update(token).digest('hex');
}
