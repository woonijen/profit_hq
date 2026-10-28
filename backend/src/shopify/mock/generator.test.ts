import { describe, expect, it } from 'vitest';
import { generateMockShop } from './generator.js';

const DAY_MS = 86_400_000;
const END = new Date('2026-01-01T00:00:00Z');

describe('generateMockShop dead-stock scenarios', () => {
  const shop = generateMockShop({ seed: 7, days: 90, endDate: END });

  /** Variant id → time of its last non-refunded sale, from the raw orders. */
  const lastSale = new Map<string, number>();
  for (const order of shop.orders) {
    if (!['PAID', 'PARTIALLY_REFUNDED', 'REFUNDED'].includes(order.displayFinancialStatus))
      continue;
    for (const { node: line } of order.lineItems.edges) {
      if (!line.variant) continue;
      const at = Date.parse(order.processedAt);
      lastSale.set(line.variant.id, Math.max(lastSale.get(line.variant.id) ?? 0, at));
    }
  }
  const daysSinceSale = (variantId: string) => {
    const at = lastSale.get(variantId);
    return at === undefined ? null : (END.getTime() - at) / DAY_MS;
  };

  it('is deterministic', () => {
    expect(generateMockShop({ seed: 7, days: 90, endDate: END })).toEqual(shop);
  });

  it('has stocked products that stopped selling at different points in time', () => {
    const variants = shop.products
      .filter((product) => product.status === 'ACTIVE')
      .flatMap((product) => product.variants.edges.map((edge) => edge.node));
    const idle = variants
      .filter((variant) => (variant.inventoryQuantity ?? 0) > 0)
      .map((variant) => daysSinceSale(variant.id));

    expect(idle.filter((days) => days !== null && days >= 30 && days < 60).length).toBeGreaterThan(
      0,
    );
    expect(idle.filter((days) => days !== null && days >= 60).length).toBeGreaterThan(0);
    expect(idle.filter((days) => days === null).length).toBeGreaterThan(0);
  });

  it('has a never-sold variant without a cost and a product too new to be flagged', () => {
    const never = shop.products.filter((product) =>
      product.variants.edges.every((edge) => !lastSale.has(edge.node.id)),
    );

    expect(
      never.some((p) => p.variants.edges.some((e) => e.node.inventoryItem.unitCost === null)),
    ).toBe(true);
    const ages = never.map((p) => (END.getTime() - Date.parse(p.createdAt)) / DAY_MS);
    expect(ages.some((age) => age < 30)).toBe(true);
    expect(ages.some((age) => age >= 90)).toBe(true);
  });

  it('creates every product before the order history starts, unless it is a new arrival', () => {
    const startMs = END.getTime() - 90 * DAY_MS;
    const early = shop.products.filter((product) => Date.parse(product.createdAt) < startMs);

    expect(early.length).toBeGreaterThanOrEqual(shop.products.length - 1);
  });
});

describe('generateMockShop customer scenarios', () => {
  const COUNTED = ['PAID', 'PARTIALLY_REFUNDED', 'REFUNDED'];
  const shop = generateMockShop({ seed: 7, days: 90, endDate: END });

  /** Customer id → counted order days (whole days before END, newest first). */
  function ordersByCustomer(data: typeof shop) {
    const byCustomer = new Map<string, number[]>();
    for (const order of data.orders) {
      if (!order.customer || !COUNTED.includes(order.displayFinancialStatus)) continue;
      const list = byCustomer.get(order.customer.id) ?? [];
      list.push(Math.ceil((END.getTime() - Date.parse(order.processedAt)) / DAY_MS));
      byCustomer.set(order.customer.id, list);
    }
    return byCustomer;
  }

  /** The rules of docs/retention.md, applied to raw orders. */
  function segmentOf(daysAgo: number[]) {
    const lastDays = Math.min(...daysAgo);
    if (lastDays > 60) return 'CHURNED';
    if (lastDays > 30) return 'AT_RISK';
    return daysAgo.length >= 3 ? 'VIP' : 'ACTIVE';
  }

  it('has customers in every segment, several in each', () => {
    const counts = new Map<string, number>();
    for (const days of ordersByCustomer(shop).values()) {
      counts.set(segmentOf(days), (counts.get(segmentOf(days)) ?? 0) + 1);
    }

    for (const segment of ['VIP', 'AT_RISK', 'CHURNED', 'ACTIVE']) {
      expect(counts.get(segment) ?? 0).toBeGreaterThanOrEqual(3);
    }
  });

  it('has frequent buyers that went quiet and one-time buyers in both lapsed segments', () => {
    const all = [...ordersByCustomer(shop).values()];
    const lapsed = (min: number, max: number) =>
      all.filter((days) => Math.min(...days) > min && Math.min(...days) <= max);

    expect(lapsed(30, 60).some((days) => days.length >= 3)).toBe(true);
    expect(lapsed(30, 60).some((days) => days.length === 1)).toBe(true);
    expect(lapsed(60, 90).some((days) => days.length >= 3)).toBe(true);
    expect(lapsed(60, 90).some((days) => days.length === 1)).toBe(true);
  });

  it('keeps guest checkouts and gives repeat buyers orders of different sizes', () => {
    expect(shop.orders.some((order) => order.customer === null)).toBe(true);

    const spend = new Set(
      shop.orders
        .filter((order) => order.customer?.id === shop.customers.at(-15)?.id)
        .map((order) => order.subtotalPriceSet.shopMoney.amount),
    );
    expect(spend.size).toBeGreaterThan(1);
  });

  it('gives the planted customers no orders outside their scenario', () => {
    const planted = shop.customers.slice(-15);
    const total = planted.reduce(
      (sum, c) => sum + shop.orders.filter((o) => o.customer?.id === c.id).length,
      0,
    );

    expect(total).toBe(4 + 3 + 5 + 4 + 3 + 3 + 3 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 2);
  });

  it('plants nothing when the history is too short to hold the scenarios', () => {
    const short = generateMockShop({ seed: 7, days: 30, endDate: END });
    const lastCustomer = short.customers.at(-1);
    const counts = [...ordersByCustomer(short).values()];

    expect(counts.length).toBeGreaterThan(0);
    expect(short.orders.filter((o) => o.customer?.id === lastCustomer?.id).length).toBeLessThan(3);
  });
});
