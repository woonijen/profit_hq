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
import { getSummary } from './metrics.service.js';

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
