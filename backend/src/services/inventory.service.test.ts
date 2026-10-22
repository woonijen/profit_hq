/**
 * Runs the dead-stock lookup against a real database (the dedicated test one,
 * `MONGODB_URI_TEST`; skipped without it) on a small fixture whose expected rows are worked
 * out by hand in the comments. Definitions: docs/dead-stock.md.
 */
import mongoose, { Types } from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { DeadStockQuery } from '../inventory/dead-stock.js';
import { type FINANCIAL_STATUSES, Order } from '../models/order.model.js';
import { DEFAULT_HOLDING_COST_RATE } from '../inventory/holding-cost.js';
import { Product } from '../models/product.model.js';
import { buildLastSoldPipeline } from '../inventory/last-sold-pipeline.js';
import { getDeadStock } from './inventory.service.js';

const hasTestDb = Boolean(process.env.MONGODB_URI_TEST);
const createdStoreIds: Types.ObjectId[] = [];

// "Now" is Jan 31 2026, noon UTC.
const NOW = new Date('2026-01-31T12:00:00Z');

const query = (window: 30 | 60 | 90): DeadStockQuery => ({
  window,
  sort: 'daysInactive',
  direction: 'desc',
  page: 1,
  pageSize: 100,
});

interface FixtureVariant {
  id: string;
  qty: number;
  cost: number | null;
}

interface FixtureProduct {
  id: string;
  status?: 'ACTIVE' | 'ARCHIVED' | 'DRAFT';
  created?: string;
  variants: FixtureVariant[];
}

interface FixtureSale {
  at: string;
  variant: string;
  qty?: number;
  refundedQty?: number;
  status?: (typeof FINANCIAL_STATUSES)[number];
}

let sequence = 0;

async function seedStore(
  timezone: string,
  products: FixtureProduct[],
  sales: FixtureSale[],
  holdingCostRate = DEFAULT_HOLDING_COST_RATE,
) {
  const storeId = new Types.ObjectId();
  createdStoreIds.push(storeId);

  await Product.insertMany(
    products.map((p) => ({
      storeId,
      shopifyId: p.id,
      title: p.id,
      status: p.status ?? 'ACTIVE',
      shopifyCreatedAt: new Date(p.created ?? '2025-06-01T00:00:00Z'),
      shopifyUpdatedAt: new Date('2026-01-01T00:00:00Z'),
      contentHash: 'fixture',
      variants: p.variants.map((v) => ({
        shopifyId: v.id,
        title: 'Default Title',
        priceCents: 1000,
        unitCostCents: v.cost,
        inventoryQuantity: v.qty,
      })),
    })),
  );

  await Order.insertMany(
    sales.map((s) => {
      sequence += 1;
      const qty = s.qty ?? 1;
      return {
        storeId,
        shopifyId: `gid://shopify/Order/${sequence}`,
        name: `#${1000 + sequence}`,
        processedAt: new Date(s.at),
        financialStatus: s.status ?? 'PAID',
        currency: 'USD',
        grossCents: qty * 1000,
        discountCents: 0,
        taxCents: 0,
        refundedCents: 0,
        lineItems: [
          {
            shopifyId: `gid://shopify/LineItem/${sequence}`,
            variantShopifyId: s.variant,
            title: 'Item',
            quantity: qty,
            refundedQuantity: s.refundedQty ?? 0,
            unitPriceCents: 1000,
            discountCents: 0,
            unitCostCents: null,
          },
        ],
        shopifyUpdatedAt: new Date(s.at),
        contentHash: 'fixture',
      };
    }),
  );

  return { _id: storeId, timezone, holdingCostRate };
}

const idsOf = async (store: Awaited<ReturnType<typeof seedStore>>, window: 30 | 60 | 90) =>
  (await getDeadStock(store, query(window), NOW)).items.map((item) => item.variantId).sort();

describe.skipIf(!hasTestDb)('getDeadStock (database)', () => {
  beforeAll(async () => {
    await mongoose.connect(process.env.MONGODB_URI_TEST ?? '');
    await Promise.all([Order.init(), Product.init()]);
  });

  afterAll(async () => {
    await Promise.all([
      Order.deleteMany({ storeId: { $in: createdStoreIds } }),
      Product.deleteMany({ storeId: { $in: createdStoreIds } }),
    ]);
    await mongoose.disconnect();
  });

  it('flags in-stock variants by how long ago their last sale was', async () => {
    const store = await seedStore(
      'UTC',
      [
        {
          id: 'P1',
          variants: [
            { id: 'sold-today', qty: 10, cost: 500 },
            { id: 'sold-29', qty: 5, cost: 1000 },
            { id: 'sold-30', qty: 4, cost: 200 },
            { id: 'sold-70', qty: 3, cost: 100 },
            { id: 'sold-100', qty: 2, cost: 100 },
          ],
        },
        {
          id: 'P2',
          created: '2025-10-01T00:00:00Z',
          variants: [{ id: 'never', qty: 7, cost: 300 }],
        },
        { id: 'P3', created: '2026-01-25T00:00:00Z', variants: [{ id: 'new', qty: 9, cost: 400 }] },
        { id: 'P4', variants: [{ id: 'empty', qty: 0, cost: 100 }] },
      ],
      [
        { at: '2026-01-31T09:00:00Z', variant: 'sold-today' },
        { at: '2026-01-02T08:00:00Z', variant: 'sold-29' }, // 29 days ago
        { at: '2026-01-01T08:00:00Z', variant: 'sold-30' }, // 30 days ago
        { at: '2025-11-22T08:00:00Z', variant: 'sold-70' }, // 70 days ago
        { at: '2025-10-23T08:00:00Z', variant: 'sold-100' }, // 100 days ago
        // An older sale does not hide a newer one.
        { at: '2025-09-01T08:00:00Z', variant: 'sold-today' },
      ],
    );

    expect(await idsOf(store, 30)).toEqual(['never', 'sold-100', 'sold-30', 'sold-70']);
    expect(await idsOf(store, 60)).toEqual(['never', 'sold-100', 'sold-70']);
    expect(await idsOf(store, 90)).toEqual(['never', 'sold-100']);

    // 'never' was created Oct 1: 122 days ago.
    const report = await getDeadStock(store, query(30), NOW);
    expect(report.items[0]).toMatchObject({
      variantId: 'never',
      lastSoldAt: null,
      daysInactive: 122,
      // Idle 90+ days: 50% off the fixture price of 1000, which still clears the cost of 300.
      priceCents: 1000,
      suggestedDiscountPct: 50,
      suggestedPriceCents: 500,
      marginAfterMarkdownCents: 200,
      belowCost: false,
    });
    // Units 4 + 3 + 2 + 7, value 800 + 300 + 200 + 2100.
    expect(report.totals).toEqual({
      variants: 4,
      units: 16,
      stockValueCents: 3400,
      monthlyHoldingCostCents: 68, // 3400 × 2%
      variantsMissingCost: 0,
    });
  });

  it('does not count refunded lines or uncounted orders as sales', async () => {
    const store = await seedStore(
      'UTC',
      [
        {
          id: 'P1',
          variants: [
            { id: 'refunded', qty: 3, cost: 100 }, // only sale was fully refunded
            { id: 'partly-refunded', qty: 3, cost: 100 }, // 1 of 2 units kept: still a sale
            { id: 'voided', qty: 3, cost: 100 }, // only sale was voided
          ],
        },
      ],
      [
        {
          at: '2026-01-30T08:00:00Z',
          variant: 'refunded',
          qty: 2,
          refundedQty: 2,
          status: 'REFUNDED',
        },
        {
          at: '2026-01-30T08:00:00Z',
          variant: 'partly-refunded',
          qty: 2,
          refundedQty: 1,
          status: 'PARTIALLY_REFUNDED',
        },
        { at: '2026-01-30T08:00:00Z', variant: 'voided', status: 'VOIDED' },
      ],
    );

    // Created Jun 1 2025, so the variants without a sale count as idle for 244 days.
    expect(await idsOf(store, 30)).toEqual(['refunded', 'voided']);
  });

  it('skips archived and draft products and other stores', async () => {
    const other = await seedStore(
      'UTC',
      [{ id: 'X', variants: [{ id: 'other', qty: 5, cost: 1 }] }],
      [],
    );
    const store = await seedStore(
      'UTC',
      [
        { id: 'P1', variants: [{ id: 'active', qty: 5, cost: 1 }] },
        { id: 'P2', status: 'ARCHIVED', variants: [{ id: 'archived', qty: 5, cost: 1 }] },
        { id: 'P3', status: 'DRAFT', variants: [{ id: 'draft', qty: 5, cost: 1 }] },
      ],
      [],
    );

    expect(await idsOf(store, 30)).toEqual(['active']);
    expect(await idsOf(other, 30)).toEqual(['other']);
  });

  it('reports variants without a cost as unknown value', async () => {
    const store = await seedStore(
      'UTC',
      [{ id: 'P1', variants: [{ id: 'nocost', qty: 6, cost: null }] }],
      [],
    );

    const report = await getDeadStock(store, query(30), NOW);

    expect(report.items[0]).toMatchObject({ unitCostCents: null, stockValueCents: null });
    expect(report.totals).toMatchObject({
      stockValueCents: 0,
      monthlyHoldingCostCents: 0,
      variantsMissingCost: 1,
    });
    expect(report.items[0]?.holdingCostCents).toBeNull();
  });

  it("prices the holding cost at the store's own rate", async () => {
    const store = await seedStore(
      'UTC',
      [{ id: 'P1', variants: [{ id: 'v', qty: 10, cost: 500 }] }], // value 5000
      [],
      0.035,
    );

    const report = await getDeadStock(store, query(30), NOW);

    expect(report.holdingCostRate).toBe(0.035);
    expect(report.items[0]?.holdingCostCents).toBe(175); // 5000 × 3.5%
    expect(report.totals.monthlyHoldingCostCents).toBe(175);
  });

  it('finds the last sales through a store index, never a collection scan', async () => {
    const store = await seedStore(
      'UTC',
      [{ id: 'P1', variants: [{ id: 'v', qty: 1, cost: 1 }] }],
      [{ at: '2026-01-10T10:00:00Z', variant: 'v' }],
    );

    const plan = JSON.stringify(
      await Order.aggregate(buildLastSoldPipeline(store._id)).explain('queryPlanner'),
    );

    expect(plan).toContain('IXSCAN');
    expect(plan).not.toContain('COLLSCAN');
  });
});
