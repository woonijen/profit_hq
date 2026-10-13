import { Types } from 'mongoose';
import { describe, expect, it } from 'vitest';
import type { MappedLineItem, MappedOrder } from './mappers.js';
import { keepStoredCogs } from './reconcile.js';

function line(shopifyId: string, unitCostCents: number | null): MappedLineItem {
  return {
    shopifyId,
    productShopifyId: null,
    variantShopifyId: null,
    title: shopifyId,
    sku: null,
    quantity: 1,
    refundedQuantity: 0,
    unitPriceCents: 1000,
    discountCents: 0,
    unitCostCents,
  };
}

const incoming: MappedOrder = {
  storeId: new Types.ObjectId(),
  shopifyId: 'gid://shopify/Order/1',
  name: '#1001',
  processedAt: new Date('2026-01-01T00:00:00Z'),
  financialStatus: 'PAID',
  currency: 'USD',
  grossCents: 2000,
  discountCents: 0,
  taxCents: 0,
  refundedCents: 0,
  lineItems: [line('a', 900), line('b', 800)],
  refunds: [],
  customerShopifyId: null,
  customerEmail: null,
  shopifyUpdatedAt: new Date('2026-01-01T00:00:00Z'),
  contentHash: 'new',
};

describe('keepStoredCogs', () => {
  it('uses the freshly looked-up costs for an order that is not stored yet', () => {
    expect(keepStoredCogs(incoming, undefined)).toBe(incoming);
  });

  it('keeps the stored cost of existing lines, even when it was unknown', () => {
    const stored = {
      shopifyId: incoming.shopifyId,
      contentHash: 'old',
      lineItems: [
        { shopifyId: 'a', unitCostCents: 300 },
        { shopifyId: 'b', unitCostCents: null },
      ],
    };
    const result = keepStoredCogs(incoming, stored);
    expect(result.lineItems.map((l) => l.unitCostCents)).toEqual([300, null]);
  });

  it('gives lines that are new to the order the current cost', () => {
    const stored = {
      shopifyId: incoming.shopifyId,
      contentHash: 'old',
      lineItems: [{ shopifyId: 'a', unitCostCents: 300 }],
    };
    const result = keepStoredCogs(incoming, stored);
    expect(result.lineItems.map((l) => l.unitCostCents)).toEqual([300, 800]);
  });
});
