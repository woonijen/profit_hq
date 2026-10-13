/** Helpers for HTTP-level tests (Supertest against the real Express app). */
import { randomUUID } from 'node:crypto';
import type { Express } from 'express';
import request, { type Response } from 'supertest';
import { Order } from '../models/order.model.js';
import { Product } from '../models/product.model.js';
import { RefreshToken } from '../models/refresh-token.model.js';
import { Store } from '../models/store.model.js';
import { SyncRun } from '../models/sync-run.model.js';
import { User } from '../models/user.model.js';

/** Every account made by a test uses this domain, which is how cleanup finds them again. */
const TEST_EMAIL_DOMAIN = 'profithq-test.example.com';
export const TEST_PASSWORD = 'correct-horse-battery';

export const uniqueEmail = () => `t-${randomUUID()}@${TEST_EMAIL_DOMAIN}`;

/** The raw refresh token from a response's `Set-Cookie`, or undefined if it sets none. */
export function refreshTokenFrom(res: Response): string | undefined {
  const cookies = res.get('Set-Cookie') ?? [];
  const cookie = cookies.find((c) => c.startsWith('refresh_token='));
  const value = cookie?.split(';')[0]?.slice('refresh_token='.length);
  return value ? value : undefined;
}

export const withRefreshCookie = (token: string) => `refresh_token=${token}`;

export interface TestUser {
  email: string;
  userId: string;
  accessToken: string;
  refreshToken: string;
}

export async function registerUser(app: Express, email = uniqueEmail()): Promise<TestUser> {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ email, password: TEST_PASSWORD });
  if (res.status !== 201) throw new Error(`register failed: ${res.status} ${res.text}`);
  const body = res.body as { user: { id: string }; accessToken: string };
  const refreshToken = refreshTokenFrom(res);
  if (!refreshToken) throw new Error('register did not set a refresh cookie');
  return { email, userId: body.user.id, accessToken: body.accessToken, refreshToken };
}

export const bearer = (user: Pick<TestUser, 'accessToken'>) => `Bearer ${user.accessToken}`;

/** Deletes every account made by tests, with their stores and everything synced into them. */
export async function deleteTestUsers(): Promise<void> {
  const users = await User.find({
    email: { $regex: `@${TEST_EMAIL_DOMAIN.replaceAll('.', '\\.')}$` },
  })
    .select('_id')
    .lean();
  const userIds = users.map((u) => u._id);
  const stores = await Store.find({ ownerId: { $in: userIds } })
    .select('_id')
    .lean();
  const storeIds = stores.map((s) => s._id);

  await Promise.all([
    Order.deleteMany({ storeId: { $in: storeIds } }),
    Product.deleteMany({ storeId: { $in: storeIds } }),
    SyncRun.deleteMany({ storeId: { $in: storeIds } }),
    RefreshToken.deleteMany({ userId: { $in: userIds } }),
  ]);
  await Store.deleteMany({ _id: { $in: storeIds } });
  await User.deleteMany({ _id: { $in: userIds } });
}
