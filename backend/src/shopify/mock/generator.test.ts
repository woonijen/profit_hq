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
