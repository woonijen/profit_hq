import type { DeadStockItem } from '@/features/inventory/types';

/** A 60-day-idle variant: 30% off $50.00 gives $35.00, above its $20.00 cost. */
export function deadStockItem(overrides: Partial<DeadStockItem> = {}): DeadStockItem {
  return {
    variantId: 'v1',
    productId: 'p1',
    productTitle: 'Canvas Tote',
    variantTitle: 'Default Title',
    sku: 'TOTE-1',
    inventoryQuantity: 10,
    priceCents: 5000,
    unitCostCents: 2000,
    stockValueCents: 20_000,
    holdingCostCents: 400,
    lastSoldAt: '2026-01-01T12:00:00.000Z',
    daysInactive: 60,
    suggestedDiscountPct: 30,
    suggestedPriceCents: 3500,
    marginAfterMarkdownCents: 1500,
    belowCost: false,
    ...overrides,
  };
}
