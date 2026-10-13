/**
 * Runs the summary pipeline against a real database (the dedicated test one,
 * `MONGODB_URI_TEST`; skipped without it) on a small fixture whose expected numbers are worked
 * out by hand, line by line, in the comments. Definitions: docs/metrics.md.
 */
import mongoose, { Types } from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildSummaryPipeline } from '../metrics/summary-pipeline.js';
import { type FINANCIAL_STATUSES, Order } from '../models/order.model.js';
import { resolveRange } from '../utils/date-range.js';
import { buildTrendPipeline } from '../metrics/trend-pipeline.js';
import { getSummary, getTrend } from './metrics.service.js';

const hasTestDb = Boolean(process.env.MONGODB_URI_TEST);
const createdStoreIds: Types.ObjectId[] = [];

interface FixtureLine {
  qty: number;
  price: number;
  /** Unit cost snapshot; null = unknown. */
  cost: number | null;
  /** Total discount on the line (all units). */
  discount?: number;
  refundedQty?: number;
}

interface FixtureOrder {
  at: string;
  status?: (typeof FINANCIAL_STATUSES)[number];
  lines: FixtureLine[];
  tax?: number;
  refunded?: number;
}

let sequence = 0;

function orderDoc(storeId: Types.ObjectId, o: FixtureOrder) {
  sequence += 1;
  const gross = o.lines.reduce((sum, l) => sum + l.qty * l.price, 0);
  const discount = o.lines.reduce((sum, l) => sum + (l.discount ?? 0), 0);
  return {
    storeId,
    shopifyId: `gid://shopify/Order/${sequence}`,
    name: `#${1000 + sequence}`,
    processedAt: new Date(o.at),
    financialStatus: o.status ?? 'PAID',
    currency: 'USD',
    grossCents: gross,
    discountCents: discount,
    taxCents: o.tax ?? 0,
    refundedCents: o.refunded ?? 0,
    lineItems: o.lines.map((l, i) => ({
      shopifyId: `gid://shopify/LineItem/${sequence}${i}`,
      title: 'Item',
      quantity: l.qty,
      refundedQuantity: l.refundedQty ?? 0,
      unitPriceCents: l.price,
      discountCents: l.discount ?? 0,
      unitCostCents: l.cost,
    })),
    shopifyUpdatedAt: new Date(o.at),
    contentHash: 'fixture',
  };
}

async function seedStore(timezone: string, orders: FixtureOrder[]) {
  const storeId = new Types.ObjectId();
  createdStoreIds.push(storeId);
  if (orders.length > 0) await Order.insertMany(orders.map((o) => orderDoc(storeId, o)));
  return { _id: storeId, currency: 'USD', timezone };
}

// "Today" is Jan 15 2026, so for 7d the current period is Jan 9–15 and the previous Jan 2–8 (UTC).
const NOW = new Date('2026-01-15T12:00:00Z');

describe.skipIf(!hasTestDb)('getSummary (database)', () => {
  beforeAll(async () => {
    await mongoose.connect(process.env.MONGODB_URI_TEST ?? '');
    await Order.init();
  });

  afterAll(async () => {
    await Order.deleteMany({ storeId: { $in: createdStoreIds } });
    await mongoose.disconnect();
  });

  it('sums a hand-computed fixture for both periods', async () => {
    const store = await seedStore('UTC', [
      // ---- current period -------------------------------------------------------------
      // A: gross 2×2000 + 1×1000 = 5000, tax 400, COGS 2×800 + 400 = 2000
      {
        at: '2026-01-10T10:00:00Z',
        tax: 400,
        lines: [
          { qty: 2, price: 2000, cost: 800 },
          { qty: 1, price: 1000, cost: 400 },
        ],
      },
      // B: gross 3000, discount 300, one unit refunded = (3000 − 300) / 3 = 900, tax 216,
      //    COGS 300 × (3 − 1) = 600 (the refunded unit went back to stock)
      {
        at: '2026-01-12T15:00:00Z',
        status: 'PARTIALLY_REFUNDED',
        tax: 216,
        refunded: 900,
        lines: [{ qty: 3, price: 1000, cost: 300, discount: 300, refundedQty: 1 }],
      },
      // C: gross 5000, tax 400, cost unknown ⇒ COGS 0 and the line is not "costed"
      { at: '2026-01-14T09:00:00Z', tax: 400, lines: [{ qty: 1, price: 5000, cost: null }] },
      // D: last second of Jan 15 still counts. Gross 1500, tax 120, COGS 500
      { at: '2026-01-15T23:59:59Z', tax: 120, lines: [{ qty: 1, price: 1500, cost: 500 }] },
      // F: fully refunded. Gross 2000, refunded 2000, tax 160, COGS 0 (both units refunded)
      {
        at: '2026-01-11T12:00:00Z',
        status: 'REFUNDED',
        tax: 160,
        refunded: 2000,
        lines: [{ qty: 2, price: 1000, cost: 400, refundedQty: 2 }],
      },
      // Ignored: voided, and one that starts at midnight of Jan 16, i.e. after the period
      { at: '2026-01-12T08:00:00Z', status: 'VOIDED', lines: [{ qty: 1, price: 9999, cost: 1 }] },
      { at: '2026-01-16T00:00:00Z', lines: [{ qty: 1, price: 7777, cost: 1 }] },
      // ---- previous period ------------------------------------------------------------
      // H: last second of Jan 8. Gross 4×500 = 2000, tax 160, COGS 4×100 = 400
      { at: '2026-01-08T23:59:59Z', tax: 160, lines: [{ qty: 4, price: 500, cost: 100 }] },
      // I: first second of Jan 2 counts. Gross 3000, tax 240, COGS 1000
      { at: '2026-01-02T00:00:00Z', tax: 240, lines: [{ qty: 1, price: 3000, cost: 1000 }] },
      // Ignored: just before the previous period, and a pending order inside it
      { at: '2026-01-01T23:59:59Z', lines: [{ qty: 1, price: 4444, cost: 1 }] },
      { at: '2026-01-05T10:00:00Z', status: 'PENDING', lines: [{ qty: 1, price: 5555, cost: 1 }] },
    ]);
    // Same period, other store: must never leak into the numbers above.
    await seedStore('UTC', [
      { at: '2026-01-10T10:00:00Z', lines: [{ qty: 1, price: 100_000, cost: 1 }] },
    ]);

    const { metrics, costCoverage, range } = await getSummary(store, '7d', NOW);

    // Current: orders A, B, C, D, F
    expect(metrics.orders.current).toBe(5);
    expect(metrics.grossRevenueCents.current).toBe(16_500); // 5000 + 3000 + 5000 + 1500 + 2000
    expect(metrics.discountsCents.current).toBe(300);
    expect(metrics.refundsCents.current).toBe(2900); // 900 + 2000
    expect(metrics.netRevenueCents.current).toBe(13_300); // 16500 − 300 − 2900
    expect(metrics.taxesCents.current).toBe(1296); // 400 + 216 + 400 + 120 + 160
    expect(metrics.cogsCents.current).toBe(3100); // 2000 + 600 + 0 + 500 + 0
    expect(metrics.netProfitCents.current).toBe(10_200); // 13300 − 3100
    expect(metrics.aovCents.current).toBe(2660); // 13300 / 5
    expect(metrics.netMargin.current).toBeCloseTo(10_200 / 13_300);
    expect(costCoverage.current).toBeCloseTo(11_500 / 16_500); // everything but order C

    // Previous: orders H and I
    expect(metrics.orders.previous).toBe(2);
    expect(metrics.grossRevenueCents.previous).toBe(5000);
    expect(metrics.netRevenueCents.previous).toBe(5000);
    expect(metrics.taxesCents.previous).toBe(400);
    expect(metrics.cogsCents.previous).toBe(1400);
    expect(metrics.netProfitCents.previous).toBe(3600);
    expect(metrics.aovCents.previous).toBe(2500);
    expect(metrics.netMargin.previous).toBeCloseTo(0.72);
    expect(costCoverage.previous).toBe(1);

    // Comparison
    expect(metrics.netRevenueCents.changeRatio).toBeCloseTo(1.66); // 5000 → 13300
    expect(metrics.netProfitCents.changeRatio).toBeCloseTo(6600 / 3600);
    expect(metrics.discountsCents.changeRatio).toBeNull(); // previous was 0
    expect(range.current.from).toBe('2026-01-09T00:00:00.000Z');
  });

  it('cuts periods at midnight in the store time zone', async () => {
    // Now is Jan 15 22:00 in Los Angeles (UTC−8), so the current 7d period is
    // [Jan 9 08:00Z, Jan 16 08:00Z) and the previous one ends at Jan 9 08:00Z.
    const now = new Date('2026-01-16T06:00:00Z');
    const store = await seedStore('America/Los_Angeles', [
      { at: '2026-01-16T09:00:00Z', lines: [{ qty: 1, price: 1000, cost: 100 }] }, // tomorrow in LA
      { at: '2026-01-16T03:00:00Z', lines: [{ qty: 1, price: 2000, cost: 100 }] }, // current
      { at: '2026-01-09T10:00:00Z', lines: [{ qty: 1, price: 3000, cost: 100 }] }, // current
      { at: '2026-01-09T07:00:00Z', lines: [{ qty: 1, price: 4000, cost: 100 }] }, // previous
    ]);

    const { metrics } = await getSummary(store, '7d', now);

    expect(metrics.grossRevenueCents).toMatchObject({ current: 5000, previous: 4000 });
  });

  it('returns zeros for a store without orders', async () => {
    const store = await seedStore('UTC', []);

    const { metrics, costCoverage } = await getSummary(store, '30d', NOW);

    expect(metrics.orders).toEqual({ current: 0, previous: 0, changeRatio: null });
    expect(metrics.netProfitCents.current).toBe(0);
    expect(metrics.netMargin.current).toBeNull();
    expect(costCoverage).toEqual({ current: 1, previous: 1 });
  });

  it('reads orders through the (storeId, processedAt) index, never a collection scan', async () => {
    const store = await seedStore('UTC', [
      { at: '2026-01-10T10:00:00Z', lines: [{ qty: 1, price: 1000, cost: 100 }] },
    ]);
    const pipeline = buildSummaryPipeline(store._id, resolveRange('7d', 'UTC', NOW));

    const plan = JSON.stringify(await Order.aggregate(pipeline).explain('queryPlanner'));

    expect(plan).toContain('IXSCAN');
    expect(plan).toContain('storeId_1_processedAt_1');
    expect(plan).not.toContain('COLLSCAN');
  });
});

describe.skipIf(!hasTestDb)('getTrend (database)', () => {
  beforeAll(async () => {
    await mongoose.connect(process.env.MONGODB_URI_TEST ?? '');
    await Order.init();
  });

  afterAll(async () => {
    await Order.deleteMany({ storeId: { $in: createdStoreIds } });
    await mongoose.disconnect();
  });

  it('buckets by day with hand-computed values, zero-filling the quiet days', async () => {
    const store = await seedStore('UTC', [
      // Jan 10: two orders. Gross 2×1000 + 1500 = 3500, COGS 2×300 + 500 = 1100
      { at: '2026-01-10T00:00:00Z', lines: [{ qty: 2, price: 1000, cost: 300 }] },
      { at: '2026-01-10T23:59:59Z', lines: [{ qty: 1, price: 1500, cost: 500 }] },
      // Jan 12: gross 3000, discount 300, one unit refunded (900), COGS 300 × 2 = 600
      {
        at: '2026-01-12T15:00:00Z',
        status: 'PARTIALLY_REFUNDED',
        refunded: 900,
        lines: [{ qty: 3, price: 1000, cost: 300, discount: 300, refundedQty: 1 }],
      },
      // Jan 15: unknown cost, so COGS 0
      { at: '2026-01-15T09:00:00Z', lines: [{ qty: 1, price: 5000, cost: null }] },
      // Ignored: voided, before the range (Jan 8), after it (Jan 16)
      { at: '2026-01-11T08:00:00Z', status: 'VOIDED', lines: [{ qty: 1, price: 9999, cost: 1 }] },
      { at: '2026-01-08T23:59:59Z', lines: [{ qty: 1, price: 4444, cost: 1 }] },
      { at: '2026-01-16T00:00:00Z', lines: [{ qty: 1, price: 7777, cost: 1 }] },
    ]);
    await seedStore('UTC', [
      { at: '2026-01-10T10:00:00Z', lines: [{ qty: 1, price: 100_000, cost: 1 }] },
    ]); // other store

    const { points, range, granularity } = await getTrend(store, '7d', 'day', NOW);

    expect(granularity).toBe('day');
    expect(range.from).toBe('2026-01-09T00:00:00.000Z');
    expect(points.map((p) => p.date)).toEqual([
      '2026-01-09',
      '2026-01-10',
      '2026-01-11',
      '2026-01-12',
      '2026-01-13',
      '2026-01-14',
      '2026-01-15',
    ]);
    const byDate = Object.fromEntries(points.map((p) => [p.date, p]));
    expect(byDate['2026-01-10']).toMatchObject({
      orders: 2,
      grossRevenueCents: 3500,
      netRevenueCents: 3500,
      cogsCents: 1100,
      netProfitCents: 2400,
    });
    expect(byDate['2026-01-10']?.netMargin).toBeCloseTo(2400 / 3500);
    expect(byDate['2026-01-12']).toMatchObject({
      orders: 1,
      grossRevenueCents: 3000,
      netRevenueCents: 1800, // 3000 − 300 − 900
      cogsCents: 600,
      netProfitCents: 1200,
    });
    expect(byDate['2026-01-15']).toMatchObject({ netRevenueCents: 5000, cogsCents: 0 });
    // Quiet days are present, empty and have no margin.
    for (const quiet of ['2026-01-09', '2026-01-11', '2026-01-13', '2026-01-14']) {
      expect(byDate[quiet]).toMatchObject({ orders: 0, netRevenueCents: 0, netMargin: null });
    }
  });

  it('adds up to exactly what the summary reports for the same range', async () => {
    const store = await seedStore('Asia/Kolkata', [
      { at: '2026-01-10T10:00:00Z', lines: [{ qty: 2, price: 1234, cost: 321 }] },
      { at: '2026-01-11T20:00:00Z', lines: [{ qty: 1, price: 999, cost: null }] },
      {
        at: '2026-01-13T05:00:00Z',
        status: 'REFUNDED',
        refunded: 2000,
        lines: [{ qty: 2, price: 1000, cost: 400, refundedQty: 2 }],
      },
      { at: '2026-01-14T18:29:59Z', lines: [{ qty: 3, price: 700, cost: 100 }] },
    ]);

    const { metrics } = await getSummary(store, '7d', NOW);
    const { points } = await getTrend(store, '7d', 'day', NOW);
    const total = (pick: (p: (typeof points)[number]) => number) =>
      points.reduce((sum, p) => sum + pick(p), 0);

    expect(total((p) => p.orders)).toBe(metrics.orders.current);
    expect(total((p) => p.grossRevenueCents)).toBe(metrics.grossRevenueCents.current);
    expect(total((p) => p.netRevenueCents)).toBe(metrics.netRevenueCents.current);
    expect(total((p) => p.cogsCents)).toBe(metrics.cogsCents.current);
    expect(total((p) => p.netProfitCents)).toBe(metrics.netProfitCents.current);
  });

  it('assigns orders to days of the store time zone, not UTC days', async () => {
    // Now is Jan 16 04:00 in Los Angeles (UTC−8): the 7d range is Jan 10–16 there.
    const now = new Date('2026-01-16T12:00:00Z');
    const store = await seedStore('America/Los_Angeles', [
      // 07:59Z on Jan 16 is 23:59 on Jan 15 in LA
      { at: '2026-01-16T07:59:59Z', lines: [{ qty: 1, price: 1000, cost: 100 }] },
      // 08:00Z is exactly midnight Jan 16 in LA
      { at: '2026-01-16T08:00:00Z', lines: [{ qty: 1, price: 2000, cost: 100 }] },
      // 07:59Z on Jan 10 is still Jan 9 in LA: before the range
      { at: '2026-01-10T07:59:59Z', lines: [{ qty: 1, price: 4000, cost: 100 }] },
      // 08:00Z on Jan 10 is the first moment of the range
      { at: '2026-01-10T08:00:00Z', lines: [{ qty: 1, price: 8000, cost: 100 }] },
    ]);

    const { points } = await getTrend(store, '7d', 'day', now);
    const gross = Object.fromEntries(points.map((p) => [p.date, p.grossRevenueCents]));

    expect(points.map((p) => p.date)).toEqual([
      '2026-01-10',
      '2026-01-11',
      '2026-01-12',
      '2026-01-13',
      '2026-01-14',
      '2026-01-15',
      '2026-01-16',
    ]);
    expect(gross['2026-01-10']).toBe(8000);
    expect(gross['2026-01-15']).toBe(1000);
    expect(gross['2026-01-16']).toBe(2000);
  });

  it('keeps one bucket per local day across a DST change', async () => {
    // New York springs forward on Mar 8 2026 (02:00 → 03:00), so that day has 23 hours.
    const now = new Date('2026-03-09T16:00:00Z');
    const store = await seedStore('America/New_York', [
      { at: '2026-03-08T04:59:59Z', lines: [{ qty: 1, price: 100, cost: 10 }] }, // Mar 7, 23:59 EST
      { at: '2026-03-08T05:00:00Z', lines: [{ qty: 1, price: 200, cost: 10 }] }, // Mar 8, 00:00 EST
      { at: '2026-03-09T03:59:59Z', lines: [{ qty: 1, price: 400, cost: 10 }] }, // Mar 8, 23:59 EDT
      { at: '2026-03-09T04:00:00Z', lines: [{ qty: 1, price: 800, cost: 10 }] }, // Mar 9, 00:00 EDT
    ]);

    const { points } = await getTrend(store, '7d', 'day', now);
    const gross = Object.fromEntries(points.map((p) => [p.date, p.grossRevenueCents]));

    expect(points).toHaveLength(7);
    expect(gross['2026-03-07']).toBe(100);
    expect(gross['2026-03-08']).toBe(600); // 200 + 400
    expect(gross['2026-03-09']).toBe(800);
  });

  it('buckets by month, clipping the first month to the range', async () => {
    // 30d ending Jan 15 2026 starts on Dec 17: December is partial, January is partial.
    const store = await seedStore('UTC', [
      { at: '2025-12-16T23:59:59Z', lines: [{ qty: 1, price: 9999, cost: 1 }] }, // before range
      { at: '2025-12-17T00:00:00Z', lines: [{ qty: 1, price: 1000, cost: 100 }] },
      { at: '2025-12-31T23:59:59Z', lines: [{ qty: 1, price: 2000, cost: 200 }] },
      { at: '2026-01-01T00:00:00Z', lines: [{ qty: 2, price: 3000, cost: 500 }] },
    ]);

    const { points, granularity } = await getTrend(store, '30d', 'month', NOW);

    expect(granularity).toBe('month');
    expect(points).toEqual([
      expect.objectContaining({
        date: '2025-12-01',
        partial: true,
        orders: 2,
        grossRevenueCents: 3000,
        cogsCents: 300,
        netProfitCents: 2700,
      }),
      expect.objectContaining({
        date: '2026-01-01',
        partial: true,
        orders: 1,
        grossRevenueCents: 6000,
        cogsCents: 1000,
        netProfitCents: 5000,
      }),
    ]);
  });

  it('draws a month boundary in the store time zone', async () => {
    // 05:00Z on Feb 1 is still Jan 31 in New York (UTC−5).
    const now = new Date('2026-02-10T12:00:00Z');
    const store = await seedStore('America/New_York', [
      { at: '2026-02-01T04:59:59Z', lines: [{ qty: 1, price: 1000, cost: 100 }] }, // Jan 31, 23:59
      { at: '2026-02-01T05:00:00Z', lines: [{ qty: 1, price: 2000, cost: 100 }] }, // Feb 1, 00:00
    ]);

    const { points } = await getTrend(store, '30d', 'month', now);

    expect(points.map((p) => [p.date, p.grossRevenueCents])).toEqual([
      ['2026-01-01', 1000],
      ['2026-02-01', 2000],
    ]);
  });

  it('returns a continuous series of empty buckets for a store without orders', async () => {
    const store = await seedStore('UTC', []);

    const { points } = await getTrend(store, '30d', 'day', NOW);

    expect(points).toHaveLength(30);
    expect(points.every((p) => p.orders === 0 && p.netMargin === null)).toBe(true);
  });

  it('reads orders through the (storeId, processedAt) index, never a collection scan', async () => {
    const store = await seedStore('UTC', [
      { at: '2026-01-10T10:00:00Z', lines: [{ qty: 1, price: 1000, cost: 100 }] },
    ]);
    const pipeline = buildTrendPipeline(store._id, resolveRange('7d', 'UTC', NOW), 'day');

    const plan = JSON.stringify(await Order.aggregate(pipeline).explain('queryPlanner'));

    expect(plan).toContain('IXSCAN');
    expect(plan).toContain('storeId_1_processedAt_1');
    expect(plan).not.toContain('COLLSCAN');
  });
});
