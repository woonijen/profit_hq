import type { PipelineStage, Types } from 'mongoose';
import type { ResolvedRange } from '../utils/date-range.js';
import {
  addOrderCosts,
  matchCountedOrders,
  PERIOD_SUM_ACCUMULATORS,
  type PeriodSums,
} from './period-sums.js';

/** Totals of one period, as summed by the pipeline. */
export interface SummaryRow extends PeriodSums {
  _id: 'current' | 'previous';
}

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
    matchCountedOrders(storeId, range.previous.from, range.current.to),
    addOrderCosts,
    {
      $group: {
        _id: { $cond: [{ $gte: ['$processedAt', range.current.from] }, 'current', 'previous'] },
        ...PERIOD_SUM_ACCUMULATORS,
      },
    },
  ];
}
