/** Who may touch which store. Needs the test database (`MONGODB_URI_TEST`); skipped without it. */
import mongoose from 'mongoose';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { User } from '../models/user.model.js';
import { bearer, deleteTestUsers, registerUser, type TestUser } from '../test/http.js';

const hasTestDb = Boolean(process.env.MONGODB_URI_TEST);

describe.skipIf(!hasTestDb)('store access (database)', () => {
  const app = createApp({ rateLimits: false });
  let owner: TestUser;
  let stranger: TestUser;
  let storeId: string;

  beforeAll(async () => {
    await mongoose.connect(process.env.MONGODB_URI_TEST ?? '');
    await User.init();
    owner = await registerUser(app);
    stranger = await registerUser(app);
    const res = await request(app).get('/api/stores').set('Authorization', bearer(owner));
    storeId = (res.body as { stores: { id: string }[] }).stores[0]?.id ?? '';
  });

  afterAll(async () => {
    await deleteTestUsers();
    await mongoose.disconnect();
  });

  const routes = [
    ['get', 'metrics/summary'],
    ['get', 'metrics/trend'],
    ['get', 'sync/latest'],
    ['post', 'sync'],
  ] as const;

  it.each(routes)('%s /stores/:id/%s needs a token', async (method, path) => {
    const res = await request(app)[method](`/api/stores/${storeId}/${path}`);
    expect(res.status).toBe(401);
  });

  it.each(routes)(
    "%s /stores/:id/%s answers 404 for someone else's store",
    async (method, path) => {
      const res = await request(app)
        [method](`/api/stores/${storeId}/${path}`)
        .set('Authorization', bearer(stranger));
      expect(res.status).toBe(404);
    },
  );

  it("lists only the caller's own stores", async () => {
    const mine = await request(app).get('/api/stores').set('Authorization', bearer(stranger));
    const ids = (mine.body as { stores: { id: string }[] }).stores.map((s) => s.id);
    expect(ids).not.toContain(storeId);
  });

  it('serves the owner their metrics, empty for a store that never synced', async () => {
    const res = await request(app)
      .get(`/api/stores/${storeId}/metrics/trend?range=7d`)
      .set('Authorization', bearer(owner));

    expect(res.status).toBe(200);
    const { points } = res.body as { points: { orders: number }[] };
    expect(points).toHaveLength(7);
    expect(points.every((p) => p.orders === 0)).toBe(true);
  });

  it('rejects a malformed store id with a 400', async () => {
    const res = await request(app)
      .get('/api/stores/not-an-id/metrics/summary')
      .set('Authorization', bearer(owner));
    expect(res.status).toBe(400);
  });

  it('starts a sync for the owner and refuses a second one while it runs', async () => {
    const first = await request(app)
      .post(`/api/stores/${storeId}/sync`)
      .set('Authorization', bearer(owner));
    expect(first.status).toBe(202);
    expect(first.body).toMatchObject({ run: { status: 'running' } });

    const second = await request(app)
      .post(`/api/stores/${storeId}/sync`)
      .set('Authorization', bearer(owner));
    expect(second.status).toBe(409);
  });
});
