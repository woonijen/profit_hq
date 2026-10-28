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
    ['get', 'customers/segments'],
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

  describe('settings', () => {
    const patch = (user: TestUser | null, body: unknown) => {
      const req = request(app).patch(`/api/stores/${storeId}/settings`);
      return (user ? req.set('Authorization', bearer(user)) : req).send(body as object);
    };
    const rateOf = async (user: TestUser) => {
      const res = await request(app).get('/api/stores').set('Authorization', bearer(user));
      return (res.body as { stores: { settings: { holdingCostRate: number } }[] }).stores[0]
        ?.settings.holdingCostRate;
    };

    it('starts a new store at 2% a month', async () => {
      expect(await rateOf(owner)).toBe(0.02);
    });

    it('needs a token', async () => {
      expect((await patch(null, { holdingCostRate: 0.05 })).status).toBe(401);
    });

    it("answers 404 for someone else's store and leaves it unchanged", async () => {
      const res = await patch(stranger, { holdingCostRate: 0.5 });

      expect(res.status).toBe(404);
      expect(await rateOf(owner)).toBe(0.02);
    });

    it.each([
      ['above 100%', { holdingCostRate: 1.5 }],
      ['negative', { holdingCostRate: -0.1 }],
      ['finer than 0.01%', { holdingCostRate: 0.00001 }],
      ['not a number', { holdingCostRate: '5%' }],
      ['missing', {}],
    ])('rejects a rate that is %s', async (_label, body) => {
      const res = await patch(owner, body);

      expect(res.status).toBe(400);
      expect(await rateOf(owner)).toBe(0.02);
    });

    it('updates the rate for the owner, and the dead-stock report uses it', async () => {
      const res = await patch(owner, { holdingCostRate: 0.035 });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ settings: { holdingCostRate: 0.035 } });
      expect(await rateOf(owner)).toBe(0.035);

      const report = await request(app)
        .get(`/api/stores/${storeId}/inventory/dead-stock`)
        .set('Authorization', bearer(owner));
      expect(report.body).toMatchObject({
        holdingCostRate: 0.035,
        totals: { variants: 0, monthlyHoldingCostCents: 0 },
      });
    });
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
