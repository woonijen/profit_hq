import type { PipelineStage, Types } from 'mongoose';
import { REVENUE_STATUSES } from '../metrics/definitions.js';

/** When a variant last sold, as found by {@link buildLastSoldPipeline}. */
export interface LastSoldRow {
  /** Shopify id of the variant. */
  _id: string;
  lastSoldAt: Date;
}

/**
 * The most recent sale of every variant of a store. A sale is a line on a counted order (same
 * statuses as the revenue metrics) with at least one unit that was not refunded, so a line
 * that was refunded in full does not count. Lines whose variant was deleted from the shop
 * (`variantShopifyId: null`) cannot be matched to stock and are dropped.
 *
 * No date bounds: how long a variant has been idle can exceed any window. The match uses the
 * `(storeId, processedAt)` index by its `storeId` prefix; the output has one row per variant
 * that ever sold, so it stays small however many orders there are. See docs/dead-stock.md.
 */
export function buildLastSoldPipeline(storeId: Types.ObjectId): PipelineStage[] {
  return [
    { $match: { storeId, financialStatus: { $in: [...REVENUE_STATUSES] } } },
    { $unwind: '$lineItems' },
    {
      $match: {
        'lineItems.variantShopifyId': { $ne: null },
        $expr: {
          $gt: ['$lineItems.quantity', { $ifNull: ['$lineItems.refundedQuantity', 0] }],
        },
      },
    },
    { $group: { _id: '$lineItems.variantShopifyId', lastSoldAt: { $max: '$processedAt' } } },
  ];
}
