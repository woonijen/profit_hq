/**
 * Runs the customer segments report against a real database (the dedicated test one,
 * `MONGODB_URI_TEST`; skipped without it) on a small fixture whose expected rows are worked
 * out by hand in the comments. Definitions: docs/retention.md.
 */
import mongoose, { Types } from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type FINANCIAL_STATUSES, Order } from '../models/order.model.js';
import { buildCustomerPipeline } from '../retention/customer-pipeline.js';
import type { CustomerSegmentsQuery } from '../retention/customer-report.js';
import { getCustomerSegments } from './retention.service.js';

const hasTestDb = Boolean(process.env.MONGODB_URI_TEST);
const createdStoreIds: Types.ObjectId[] = [];

// "Now" is Jan 31 2026, noon UTC.
const NOW = new Date('2026-01-31T12:00:00Z');

const query = (overrides: Partial<CustomerSegmentsQuery> = {}): CustomerSegmentsQuery => ({
  sort: 'lifetimeSpend',
  direction: 'desc',
  page: 1,
  pageSize: 100,
  ...overrides,
});

interface FixtureOrder {
  /** Customer number; null = guest checkout. */
  customer: number | null;
  at: string;
  gross: number;
  discount?: number;
  refunded?: number;
  email?: string;
  name?: string;
  status?: (typeof FINANCIAL_STATUSES)[number];
}

let sequence = 0;

async function seedStore(timezone: string, orders: FixtureOrder[]) {
  const storeId = new Types.ObjectId();
  createdStoreIds.push(storeId);

  await Order.insertMany(
    orders.map((o) => {
      sequence += 1;
      return {
        storeId,
        shopifyId: `gid://shopify/Order/${sequence}`,
        name: `#${1000 + sequence}`,
        processedAt: new Date(o.at),
        financialStatus: o.status ?? 'PAID',
        currency: 'USD',
        grossCents: o.gross,
        discountCents: o.discount ?? 0,
        taxCents: 0,
        refundedCents: o.refunded ?? 0,
        customerShopifyId: o.customer === null ? null : `gid://shopify/Customer/${o.customer}`,
        customerEmail: o.email ?? null,
        customerName: o.name ?? null,
        shopifyUpdatedAt: new Date(o.at),
        contentHash: 'fixture',
      };
    }),
  );

  return { _id: storeId, timezone };
}

/**
 * Five customers, three kinds of order that must not count, and two guest checkouts.
 *
 * | Customer | Orders (net)                                        | Spend  | Last order     | Segment  |
 * | -------- | --------------------------------------------------- | ------ | -------------- | -------- |
 * | 1        | 9,000 + 5,000 + 5,000 (partial refund of 3,000)     | 19,000 | Jan 31, 0 days | VIP      |
 * | 2        | 4,000 × 3                                           | 12,000 | Jan 1, 30 days | VIP      |
 * | 3        | 6,000 × 3                                           | 18,000 | Dec 31, 31 d.  | AT_RISK  |
 * | 4        | 7,000 refunded in full                              | 0      | Dec 1, 61 days | CHURNED  |
 * | 5        | 2,000 (a voided and a pending order are ignored)    | 2,000  | Jan 25, 6 days | ACTIVE   |
 *
 * Total spend 51,000. Customer 2 sits on the last recent day, 3 on the first At-Risk day and 4
 * on the first Churned day. Guest checkouts: two paid orders (a voided one is ignored).
 */
const FIXTURE: FixtureOrder[] = [
  // Customer 1: the email changes over time, and only the older orders carry a name.
  {
    customer: 1,
    at: '2026-01-31T10:00:00Z',
    gross: 10_000,
    discount: 1_000,
    email: 'ava.new@example.test',
  },
  {
    customer: 1,
    at: '2026-01-20T10:00:00Z',
    gross: 5_000,
    email: 'ava.old@example.test',
    name: 'Ava Nguyen',
  },
  {
    customer: 1,
    at: '2026-01-05T10:00:00Z',
    gross: 8_000,
    refunded: 3_000,
    status: 'PARTIALLY_REFUNDED',
    email: 'ava.old@example.test',
    name: 'Ava Nguyen',
  },
  // Customer 2: last order exactly 30 days ago, still recent.
  { customer: 2, at: '2026-01-01T10:00:00Z', gross: 4_000, email: 'liam@example.test' },
  { customer: 2, at: '2025-12-20T10:00:00Z', gross: 4_000, email: 'liam@example.test' },
  { customer: 2, at: '2025-12-10T10:00:00Z', gross: 4_000, email: 'liam@example.test' },
  // Customer 3: last order exactly 31 days ago. No email on any order.
  { customer: 3, at: '2025-12-31T10:00:00Z', gross: 6_000 },
  { customer: 3, at: '2025-11-30T10:00:00Z', gross: 6_000 },
  { customer: 3, at: '2025-11-15T10:00:00Z', gross: 6_000 },
  // Customer 4: one order, refunded in full, 61 days ago.
  {
    customer: 4,
    at: '2025-12-01T10:00:00Z',
    gross: 7_000,
    refunded: 7_000,
    status: 'REFUNDED',
    email: 'zoe@example.test',
    name: 'Zoe Kim',
  },
  // Customer 5: one real order; the later voided and pending ones do not count.
  { customer: 5, at: '2026-01-25T10:00:00Z', gross: 2_000, email: 'mia@example.test' },
  { customer: 5, at: '2026-01-30T10:00:00Z', gross: 9_999, status: 'VOIDED' },
  { customer: 5, at: '2026-01-30T11:00:00Z', gross: 9_999, status: 'PENDING' },
  // Guest checkouts.
  { customer: null, at: '2026-01-29T10:00:00Z', gross: 3_000 },
  { customer: null, at: '2026-01-10T10:00:00Z', gross: 3_000 },
  { customer: null, at: '2026-01-28T10:00:00Z', gross: 3_000, status: 'VOIDED' },
];

describe.skipIf(!hasTestDb)('getCustomerSegments (database)', () => {
  beforeAll(async () => {
    await mongoose.connect(process.env.MONGODB_URI_TEST ?? '');
    await Order.init();
  });

  afterAll(async () => {
    await Order.deleteMany({ storeId: { $in: createdStoreIds } });
    await mongoose.disconnect();
  });

  it('works out every customer by hand: spend, orders, last order, segment', async () => {
    const store = await seedStore('UTC', FIXTURE);

    const report = await getCustomerSegments(store, query(), NOW);

    expect(
      report.items.map((row) => [
        row.customerId,
        row.lifetimeSpendCents,
        row.orders,
        row.daysSinceLastOrder,
        row.segment,
      ]),
    ).toEqual([
      ['gid://shopify/Customer/1', 19_000, 3, 0, 'VIP'],
      ['gid://shopify/Customer/3', 18_000, 3, 31, 'AT_RISK'],
      ['gid://shopify/Customer/2', 12_000, 3, 30, 'VIP'],
      ['gid://shopify/Customer/5', 2_000, 1, 6, 'ACTIVE'],
      ['gid://shopify/Customer/4', 0, 1, 61, 'CHURNED'],
    ]);
    expect(report.items[0]?.lastOrderAt).toEqual(new Date('2026-01-31T10:00:00Z'));
  });

  it('summarises the segments and counts the guest orders left out', async () => {
    const store = await seedStore('UTC', FIXTURE);

    const { summary } = await getCustomerSegments(store, query(), NOW);

    expect(summary.customers).toBe(5);
    expect(summary.guestOrders).toBe(2);
    expect(summary.segments.VIP).toEqual({
      customers: 2,
      lifetimeSpendCents: 31_000,
      shareOfRevenue: 31_000 / 51_000,
      averageSpendCents: 15_500,
    });
    expect(summary.segments.AT_RISK).toMatchObject({
      customers: 1,
      lifetimeSpendCents: 18_000,
      averageSpendCents: 18_000,
    });
    expect(summary.segments.CHURNED).toEqual({
      customers: 1,
      lifetimeSpendCents: 0,
      shareOfRevenue: 0,
      averageSpendCents: 0,
    });
    expect(summary.segments.ACTIVE).toMatchObject({ customers: 1, lifetimeSpendCents: 2_000 });
  });

  it('identifies a customer by their latest email, else by their Shopify id', async () => {
    const store = await seedStore('UTC', FIXTURE);

    const { items } = await getCustomerSegments(store, query(), NOW);
    const identifier = (n: number) =>
      items.find((row) => row.customerId.endsWith(`/${n}`))?.identifier;

    expect(identifier(1)).toBe('ava.new@example.test'); // newest order wins
    expect(identifier(3)).toBe('3'); // no email on any order
  });

  it('takes the name from the latest order that has one', async () => {
    const store = await seedStore('UTC', FIXTURE);

    const { items } = await getCustomerSegments(store, query(), NOW);
    const name = (n: number) => items.find((row) => row.customerId.endsWith(`/${n}`))?.name;

    expect(name(1)).toBe('Ava Nguyen'); // the newest order has none
    expect(name(2)).toBeNull();
    expect(name(4)).toBe('Zoe Kim');
  });

  it('ignores voided and pending orders, even for the last order date', async () => {
    const store = await seedStore('UTC', FIXTURE);

    const { items } = await getCustomerSegments(store, query(), NOW);

    // The voided order on Jan 30 would make customer 5 one day old.
    expect(items.find((row) => row.customerId.endsWith('/5'))?.daysSinceLastOrder).toBe(6);
  });

  it('filters the list by segment while the summary still covers everyone', async () => {
    const store = await seedStore('UTC', FIXTURE);

    const report = await getCustomerSegments(store, query({ segment: 'VIP' }), NOW);

    expect(report.items.map((row) => row.customerId)).toEqual([
      'gid://shopify/Customer/1',
      'gid://shopify/Customer/2',
    ]);
    expect(report.page.totalItems).toBe(2);
    expect(report.summary.customers).toBe(5);
  });

  it('counts the days in the store time zone', async () => {
    const orders: FixtureOrder[] = [{ customer: 1, at: '2026-01-31T02:00:00Z', gross: 1_000 }];
    const utc = await seedStore('UTC', orders);
    const losAngeles = await seedStore('America/Los_Angeles', orders);

    // 02:00 UTC on Jan 31 is the evening of Jan 30 in Los Angeles (UTC-8), where "now" (12:00
    // UTC) is already Jan 31: one day apart there, the same day in UTC.
    expect((await getCustomerSegments(utc, query(), NOW)).items[0]?.daysSinceLastOrder).toBe(0);
    expect((await getCustomerSegments(losAngeles, query(), NOW)).items[0]?.daysSinceLastOrder).toBe(
      1,
    );
  });

  it("does not mix in another store's orders", async () => {
    const store = await seedStore('UTC', [{ customer: 1, at: '2026-01-30T10:00:00Z', gross: 100 }]);
    await seedStore('UTC', [{ customer: 1, at: '2026-01-31T10:00:00Z', gross: 99_999 }]);

    const { items } = await getCustomerSegments(store, query(), NOW);

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ lifetimeSpendCents: 100, orders: 1, daysSinceLastOrder: 1 });
  });

  it('reports an empty store without customers', async () => {
    const store = await seedStore('UTC', []);

    const report = await getCustomerSegments(store, query(), NOW);

    expect(report.items).toEqual([]);
    expect(report.summary.customers).toBe(0);
    expect(report.summary.guestOrders).toBe(0);
    expect(report.summary.segments.VIP.shareOfRevenue).toBeNull();
  });

  it('reads orders through the (storeId, processedAt) index, never a collection scan', async () => {
    const store = await seedStore('UTC', FIXTURE);

    const plan = JSON.stringify(
      await Order.aggregate(buildCustomerPipeline(store._id)).explain('queryPlanner'),
    );

    expect(plan).toContain('IXSCAN');
    expect(plan).toContain('storeId_1_processedAt_1');
    expect(plan).not.toContain('COLLSCAN');
  });
});
