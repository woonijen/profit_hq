import { randomUUID } from 'node:crypto';
import { Types } from 'mongoose';
import { env } from '../config/env.js';
import { AppError } from '../errors/app-error.js';
import { RefreshToken } from '../models/refresh-token.model.js';
import { User } from '../models/user.model.js';
import { hashPassword, verifyPassword } from '../utils/password.js';
import { generateRefreshToken, hashRefreshToken, signAccessToken } from '../utils/tokens.js';
import { ensureDefaultStore } from './store.service.js';

export interface PublicUser {
  id: string;
  email: string;
  createdAt: Date;
}

export interface SessionMeta {
  userAgent?: string;
  ip?: string;
}

export interface AuthSession {
  user: PublicUser;
  accessToken: string;
  /** Raw refresh token. Goes into the httpOnly cookie, never into the response body. */
  refreshToken: string;
}

const INVALID_CREDENTIALS = 'Invalid email or password';

// Verified when the email is unknown so login takes about as long either way.
const dummyHash = hashPassword('not-a-real-password');

function toPublicUser(user: { id: string; email: string; createdAt: Date }): PublicUser {
  return { id: user.id, email: user.email, createdAt: user.createdAt };
}

function isDuplicateKey(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'code' in err && err.code === 11000;
}

/** Stores a new refresh token in `family` and returns the raw value to hand to the client. */
async function issueRefreshToken(
  userId: Types.ObjectId,
  family: string,
  meta: SessionMeta,
  id = new Types.ObjectId(),
): Promise<string> {
  const refreshToken = generateRefreshToken();
  await RefreshToken.create({
    _id: id,
    userId,
    family,
    tokenHash: hashRefreshToken(refreshToken),
    expiresAt: new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000),
    userAgent: meta.userAgent,
    ip: meta.ip,
  });
  return refreshToken;
}

function revokeFamily(family: string): Promise<unknown> {
  return RefreshToken.updateMany({ family, revokedAt: null }, { revokedAt: new Date() });
}

async function startSession(
  user: { _id: Types.ObjectId; id: string; email: string; createdAt: Date },
  meta: SessionMeta,
): Promise<AuthSession> {
  const [accessToken, refreshToken] = await Promise.all([
    signAccessToken(user.id),
    issueRefreshToken(user._id, randomUUID(), meta),
  ]);
  return { user: toPublicUser(user), accessToken, refreshToken };
}

export async function register(
  input: { email: string; password: string },
  meta: SessionMeta,
): Promise<AuthSession> {
  const passwordHash = await hashPassword(input.password);
  let user;
  try {
    user = await User.create({ email: input.email, passwordHash });
  } catch (err) {
    if (isDuplicateKey(err)) throw AppError.conflict('An account with this email already exists');
    throw err;
  }
  await ensureDefaultStore(user._id);
  return startSession(user, meta);
}

export async function login(
  input: { email: string; password: string },
  meta: SessionMeta,
): Promise<AuthSession> {
  const user = await User.findOne({ email: input.email }).select('+passwordHash');
  const valid = await verifyPassword(user?.passwordHash ?? (await dummyHash), input.password);
  if (!user || !valid) throw AppError.unauthorized(INVALID_CREDENTIALS);
  return startSession(user, meta);
}

/**
 * Rotates a refresh token: the presented one is revoked and a new one is issued in the same
 * family. Presenting a token that was already rotated or revoked means it has been replayed
 * (or stolen), so the whole family is revoked and the real user has to log in again.
 */
export async function refresh(
  presentedToken: string | undefined,
  meta: SessionMeta,
): Promise<AuthSession> {
  if (!presentedToken) throw AppError.unauthorized('Missing refresh token');

  const record = await RefreshToken.findOne({ tokenHash: hashRefreshToken(presentedToken) });
  if (!record) throw AppError.unauthorized('Invalid refresh token');

  if (record.revokedAt) {
    await revokeFamily(record.family);
    throw AppError.unauthorized('Refresh token reuse detected');
  }
  if (record.expiresAt.getTime() <= Date.now()) {
    throw AppError.unauthorized('Refresh token expired');
  }

  const user = await User.findById(record.userId);
  if (!user) {
    await revokeFamily(record.family);
    throw AppError.unauthorized('Invalid refresh token');
  }

  // Conditional update so two concurrent requests with the same token cannot both win.
  const nextId = new Types.ObjectId();
  const claimed = await RefreshToken.updateOne(
    { _id: record._id, revokedAt: null },
    { revokedAt: new Date(), replacedBy: nextId },
  );
  if (claimed.modifiedCount !== 1) {
    await revokeFamily(record.family);
    throw AppError.unauthorized('Refresh token reuse detected');
  }

  const [accessToken, refreshToken] = await Promise.all([
    signAccessToken(user.id),
    issueRefreshToken(user._id, record.family, meta, nextId),
  ]);
  return { user: toPublicUser(user), accessToken, refreshToken };
}

/** Revokes the session the token belongs to. Idempotent: unknown tokens are ignored. */
export async function logout(presentedToken: string | undefined): Promise<void> {
  if (!presentedToken) return;
  const record = await RefreshToken.findOne({ tokenHash: hashRefreshToken(presentedToken) });
  if (record) await revokeFamily(record.family);
}

export async function getCurrentUser(userId: string): Promise<PublicUser> {
  const user = await User.findById(userId);
  if (!user) throw AppError.unauthorized('Account no longer exists');
  return toPublicUser(user);
}
