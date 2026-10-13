import type { PipelineStage, Types } from 'mongoose';
import type { ResolvedRange } from '../utils/date-range.js';
import { REVENUE_STATUSES } from './definitions.js';

/** Totals of one period, as summed by the pipeline. All money in cents. */
export interface SummaryRow {
  _id: 'current' | 'previous';
  orders: number;
  grossCents: number;
  discountCents: number;
  refundedCents: number;
  taxCents: number;
  cogsCents: number;
  /** Gross revenue of the lines whose cost is known; the rest of gross has no COGS. */
  costedGrossCents: number;
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

/**
 * One pass over the orders of the current and the previous period together (they are adjacent,
 * so a single index range covers both): filter, work out each order's COGS from its lines,
 * then group into one row per period. Line items are never unwound, so order-level money is
 * not multiplied by the number of lines.
 */
export function buildSummaryPipeline(
  storeId: Types.ObjectId,
  range: ResolvedRange,
): PipelineStage[] {
  return [
    {
      $match: {
        storeId,
        processedAt: { $gte: range.previous.from, $lt: range.current.to },
        financialStatus: { $in: [...REVENUE_STATUSES] },
      },
    },
    { $addFields: { cogsCents: orderCogs, costedGrossCents: orderCostedGross } },
    {
      $group: {
        _id: { $cond: [{ $gte: ['$processedAt', range.current.from] }, 'current', 'previous'] },
        orders: { $sum: 1 },
        grossCents: { $sum: '$grossCents' },
        discountCents: { $sum: '$discountCents' },
        refundedCents: { $sum: '$refundedCents' },
        taxCents: { $sum: '$taxCents' },
        cogsCents: { $sum: '$cogsCents' },
        costedGrossCents: { $sum: '$costedGrossCents' },
      },
    },
  ];
}
