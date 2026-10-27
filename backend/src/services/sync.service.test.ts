/**
 * Sync engine tests against a real database (the dedicated test one, `MONGODB_URI_TEST`).
 * They skip themselves when it is not configured.
 *
 * The headline test checks the idempotency invariant documented in docs/sync.md: syncing the
 * same Shopify data any number of times leaves the database exactly as the first sync did.
 */
import mongoose, { Types } from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Order } from '../models/order.model.js';
import { Product } from '../models/product.model.js';
import { Store } from '../models/store.model.js';
import { SyncRun } from '../models/sync-run.model.js';
import { generateMockShop, type MockShopData } from '../shopify/mock/generator.js';
import { MockShopifyClient } from '../shopify/mock/mock-client.js';
import type { ShopifyClient } from '../shopify/shopify-client.js';
import { toCents } from '../sync/mappers.js';
import { STALE_AFTER_MS } from './sync-run.service.js';
import { PAGE_SIZE, startSync } from './sync.service.js';

const hasTestDb = Boolean(process.env.MONGODB_URI_TEST);

const createdStoreIds: Types.ObjectId[] = [];

/** Fixed seed and end date: every call returns the same shop. */
function mockData(): MockShopData {
  return generateMockShop({ seed: 7, days: 30, endDate: new Date('2026-01-01T00:00:00Z') });
}

/** Each test syncs into its own store, so tests cannot see each other's data. */
async function createStore() {
  const store = await Store.create({
    ownerId: new Types.ObjectId(),
    shopDomain: `test-${new Types.ObjectId().toHexString()}.myshopify.com`,
    currency: 'USD',
    timezone: 'UTC',
  });
  createdStoreIds.push(store._id);
  return store;
}

/** Runs a sync to the end and returns the finished run as stored. */
async function runSync(store: { _id: Types.ObjectId; currency: string }, client: ShopifyClient) {
  const { run, done } = await startSync(store, client);
  await done;
  const finished = await SyncRun.findById(run.id).lean();
  if (!finished) throw new Error('sync run disappeared');
  return finished;
}

/** What the dashboard would be computed from, reduced to a few numbers. */
async function snapshot(storeId: Types.ObjectId) {
  const [orders, products, latest] = await Promise.all([
    Order.find({ storeId }).lean(),
    Product.countDocuments({ storeId }),
    Order.findOne({ storeId }).sort({ updatedAt: -1 }).lean(),
  ]);
  return {
    orders: orders.length,
    products,
    netRevenueCents: orders.reduce(
      (s, o) => s + o.grossCents - o.discountCents - o.refundedCents,
      0,
    ),
    cogsCents: orders.reduce(
      (s, o) => s + o.lineItems.reduce((t, l) => t + (l.unitCostCents ?? 0) * l.quantity, 0),
      0,
    ),
    lastWriteAt: latest?.updatedAt.getTime(),
  };
}

/** Wraps a client so that selected calls can be intercepted. */
function wrapClient(base: ShopifyClient, overrides: Partial<ShopifyClient>): ShopifyClient {
  return {
    fetchProducts: (args) => base.fetchProducts(args),
    fetchCustomers: (args) => base.fetchCustomers(args),
    fetchOrders: (args) => base.fetchOrders(args),
    ...overrides,
  };
}

describe.skipIf(!hasTestDb)('sync service (database)', () => {
  beforeAll(async () => {
    await mongoose.connect(process.env.MONGODB_URI_TEST ?? '');
    // The one-running-sync lock is a unique partial index, so it has to exist before the tests.
    await Promise.all(mongoose.modelNames().map((name) => mongoose.model(name).init()));
  });

  afterAll(async () => {
    const storeId = { $in: createdStoreIds };
    await Promise.all([
      Order.deleteMany({ storeId }),
      Product.deleteMany({ storeId }),
      SyncRun.deleteMany({ storeId }),
      Store.deleteMany({ _id: storeId }),
    ]);
    await mongoose.disconnect();
  });

  it('is idempotent: syncing the same data three times changes nothing after the first', async () => {
    const data = mockData();
    const client = new MockShopifyClient(data);
    const store = await createStore();
    const expectedNetRevenue = data.orders.reduce(
      (sum, o) =>
        sum +
        toCents(o.subtotalPriceSet.shopMoney.amount) -
        toCents(o.totalRefundedSet.shopMoney.amount),
      0,
    );

    const first = await runSync(store, client);
    expect(first.status).toBe('succeeded');
    expect(first.products).toMatchObject({
      inserted: data.products.length,
      updated: 0,
      unchanged: 0,
    });
    expect(first.orders).toMatchObject({ inserted: data.orders.length, updated: 0, unchanged: 0 });

    const afterFirst = await snapshot(store._id);
    expect(afterFirst).toMatchObject({
      orders: data.orders.length,
      products: data.products.length,
      netRevenueCents: expectedNetRevenue,
    });

    for (const attempt of [2, 3]) {
      const run = await runSync(store, client);
      expect(run.status, `sync #${attempt}`).toBe('succeeded');
      expect(run.products).toMatchObject({
        inserted: 0,
        updated: 0,
        unchanged: data.products.length,
      });
      expect(run.orders).toMatchObject({ inserted: 0, updated: 0, unchanged: data.orders.length });
      // Same numbers, and no document was even rewritten.
      expect(await snapshot(store._id), `sync #${attempt}`).toEqual(afterFirst);
    }
  });

  it('stores the customer id, email and name on the order, and nulls for a guest checkout', async () => {
    const data = mockData();
    const store = await createStore();
    await runSync(store, new MockShopifyClient(data));

    const stored = new Map(
      (await Order.find({ storeId: store._id }).lean()).map((o) => [o.shopifyId, o]),
    );
    const withCustomer = data.orders.filter((o) => o.customer);
    const guests = data.orders.filter((o) => !o.customer);
    // The mock plants both kinds, otherwise this test would prove nothing.
    expect(withCustomer.length).toBeGreaterThan(0);
    expect(guests.length).toBeGreaterThan(0);

    for (const { id, customer } of withCustomer) {
      expect(stored.get(id), id).toMatchObject({
        customerShopifyId: customer?.id,
        customerEmail: customer?.email,
        customerName: `${customer?.firstName} ${customer?.lastName}`,
      });
    }
    for (const { id } of guests) {
      expect(stored.get(id), id).toMatchObject({
        customerShopifyId: null,
        customerEmail: null,
        customerName: null,
      });
    }
  });

  it('keeps the COGS snapshot of past orders when product costs change later', async () => {
    const store = await createStore();
    await runSync(store, new MockShopifyClient(mockData()));
    const before = await snapshot(store._id);

    // The merchant doubles every cost in Shopify.
    const pricier = mockData();
    for (const product of pricier.products) {
      for (const { node } of product.variants.edges) {
        const cost = node.inventoryItem.unitCost;
        if (cost) cost.amount = (toCents(cost.amount) / 50).toFixed(2);
      }
    }
    const run = await runSync(store, new MockShopifyClient(pricier));

    expect(run.products.updated).toBeGreaterThan(0);
    expect(run.orders).toMatchObject({ inserted: 0, updated: 0 });
    expect(await snapshot(store._id)).toEqual(before);
  });

  it('refuses to start a second sync while one is running', async () => {
    const store = await createStore();
    const base = new MockShopifyClient(mockData());
    let release = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const gated = wrapClient(base, {
      fetchProducts: async (args) => {
        await gate;
        return base.fetchProducts(args);
      },
    });

    const first = await startSync(store, gated);
    await expect(startSync(store, gated)).rejects.toMatchObject({ statusCode: 409 });
    expect(await SyncRun.countDocuments({ storeId: store._id })).toBe(1);

    release();
    await first.done;
    expect((await runSync(store, base)).status).toBe('succeeded');
  });

  it('takes over a running sync that stopped reporting progress', async () => {
    const store = await createStore();
    const crashed = await SyncRun.create({
      storeId: store._id,
      heartbeatAt: new Date(Date.now() - STALE_AFTER_MS - 60_000),
    });

    const run = await runSync(store, new MockShopifyClient(mockData()));

    expect(run.status).toBe('succeeded');
    expect((await SyncRun.findById(crashed._id).lean())?.status).toBe('failed');
  });

  it('records a failed run and the next run resumes where it stopped', async () => {
    const data = mockData();
    expect(data.orders.length).toBeGreaterThan(PAGE_SIZE * 2);
    const base = new MockShopifyClient(data);
    const store = await createStore();

    let orderCalls = 0;
    const flaky = wrapClient(base, {
      fetchOrders: (args) => {
        orderCalls += 1;
        return orderCalls === 2
          ? Promise.reject(new Error('Shopify unavailable'))
          : base.fetchOrders(args);
      },
    });

    const failed = await runSync(store, flaky);
    expect(failed.status).toBe('failed');
    expect(failed.error).toMatchObject({ entity: 'orders', message: 'Shopify unavailable' });
    expect(failed.orders.inserted).toBe(PAGE_SIZE);
    expect(failed.checkpoint?.entity).toBe('orders');

    const resumed = await runSync(store, base);
    expect(resumed.status).toBe('succeeded');
    expect(resumed.resumed).toBe(true);
    // Products were finished by the failed run, so they are not fetched again.
    expect(resumed.products).toMatchObject({ inserted: 0, updated: 0, unchanged: 0 });
    expect(resumed.orders).toMatchObject({
      inserted: data.orders.length - PAGE_SIZE,
      unchanged: 0,
    });
    expect(resumed.checkpoint).toBeUndefined();
    expect((await snapshot(store._id)).orders).toBe(data.orders.length);
  });

  it('skips an order that cannot be mapped, finishes as partial, and retries it next time', async () => {
    const data = mockData();
    const broken = data.orders[3];
    if (!broken) throw new Error('mock data has too few orders');
    broken.subtotalPriceSet.shopMoney.amount = '0.01';
    const store = await createStore();

    const partial = await runSync(store, new MockShopifyClient(data));
    expect(partial.status).toBe('partial');
    expect(partial.orders).toMatchObject({ inserted: data.orders.length - 1, failed: 1 });
    expect(partial.failures).toHaveLength(1);
    expect(partial.failures[0]).toMatchObject({ entity: 'orders', shopifyId: broken.id });

    const fixed = await runSync(store, new MockShopifyClient(mockData()));
    expect(fixed.status).toBe('succeeded');
    expect(fixed.orders).toMatchObject({
      inserted: 1,
      unchanged: data.orders.length - 1,
      failed: 0,
    });
  });
});
