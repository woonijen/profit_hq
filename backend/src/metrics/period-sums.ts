/**
 * The pieces of aggregation shared by every metrics pipeline (summary, trend), so that the same
 * order is counted, costed and summed the same way everywhere. Definitions: docs/metrics.md.
 */
import type { PipelineStage, Types } from 'mongoose';
import { REVENUE_STATUSES } from './definitions.js';

/** Totals of a set of orders, as summed by the pipelines. All money in cents. */
export interface PeriodSums {
  orders: number;
  grossCents: number;
  discountCents: number;
  refundedCents: number;
  taxCents: number;
  cogsCents: number;
  /** Gross revenue of the lines whose cost is known; the rest of gross has no COGS. */
  costedGrossCents: number;
}

/** Net Revenue: Gross − Discounts − Refunds. Tax is never part of it. See docs/metrics.md. */
export function netRevenueCents(
  sums: Pick<PeriodSums, 'grossCents' | 'discountCents' | 'refundedCents'>,
): number {
  return sums.grossCents - sums.discountCents - sums.refundedCents;
}

/** COGS of one order: unit cost × units that stayed sold. Unknown cost counts as 0. */
const orderCogs = {
  $sum: {
    $map: {
      input: '$lineItems',
      as: 'line',
      in: {
        $cond: [
          { $isNumber: '$$line.unitCostCents' },
          {
            $multiply: [
              '$$line.unitCostCents',
              { $subtract: ['$$line.quantity', { $ifNull: ['$$line.refundedQuantity', 0] }] },
            ],
          },
          0,
        ],
      },
    },
  },
};

/** Gross revenue of one order that sits on lines with a known cost. */
const orderCostedGross = {
  $sum: {
    $map: {
      input: '$lineItems',
      as: 'line',
      in: {
        $cond: [
          { $isNumber: '$$line.unitCostCents' },
          { $multiply: ['$$line.unitPriceCents', '$$line.quantity'] },
          0,
        ],
      },
    },
  },
};

/** Selects the orders of a store that count towards the metrics and fall in `[from, to)`. */
export function matchCountedOrders(storeId: Types.ObjectId, from: Date, to: Date): PipelineStage {
  return {
    $match: {
      storeId,
      processedAt: { $gte: from, $lt: to },
      financialStatus: { $in: [...REVENUE_STATUSES] },
    },
  };
}

/** Works out each order's COGS from its lines. Line items are never `$unwind`ed. */
export const addOrderCosts: PipelineStage = {
  $addFields: { cogsCents: orderCogs, costedGrossCents: orderCostedGross },
};

/** The `$group` accumulators that produce a {@link PeriodSums} (add an `_id` to use them). */
export const PERIOD_SUM_ACCUMULATORS = {
  orders: { $sum: 1 },
  grossCents: { $sum: '$grossCents' },
  discountCents: { $sum: '$discountCents' },
  refundedCents: { $sum: '$refundedCents' },
  taxCents: { $sum: '$taxCents' },
  cogsCents: { $sum: '$cogsCents' },
  costedGrossCents: { $sum: '$costedGrossCents' },
};
