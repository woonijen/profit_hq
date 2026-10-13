import type { MappedOrder } from './mappers.js';

/** The part of a stored order the COGS snapshot rule needs. */
export interface StoredOrderCogs {
  shopifyId: string;
  contentHash: string;
  lineItems: { shopifyId: string; unitCostCents: number | null }[];
}

/**
 * COGS is a snapshot taken when a line is first synced, so later cost changes never rewrite
 * past profit. When an existing order is rewritten (Shopify changed it), lines that were
 * already stored keep their stored cost; only lines new to the order take the current cost.
 */
export function keepStoredCogs(
  incoming: MappedOrder,
  stored: StoredOrderCogs | undefined,
): MappedOrder {
  if (!stored) return incoming;

  const snapshot = new Map(stored.lineItems.map((line) => [line.shopifyId, line.unitCostCents]));
  return {
    ...incoming,
    lineItems: incoming.lineItems.map((line) =>
      snapshot.has(line.shopifyId)
        ? { ...line, unitCostCents: snapshot.get(line.shopifyId) ?? null }
        : line,
    ),
  };
}
