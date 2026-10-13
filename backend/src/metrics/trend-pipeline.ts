import type { PipelineStage, Types } from 'mongoose';
import type { ResolvedRange } from '../utils/date-range.js';
import {
  addOrderCosts,
  matchCountedOrders,
  PERIOD_SUM_ACCUMULATORS,
  type PeriodSums,
} from './period-sums.js';

export const GRANULARITIES = ['day', 'month'] as const;
export type Granularity = (typeof GRANULARITIES)[number];

/** Totals of one bucket. `_id` is the local calendar date the bucket starts on (`YYYY-MM-DD`). */
export interface TrendRow extends PeriodSums {
  _id: string;
}

/**
 * Same pass as the summary, but over the current period only and grouped by calendar day or
 * month in the store's time zone. `$dateTrunc` cuts at local midnight (or the 1st), DST
 * included; `$dateToString` then names the bucket by its local date, so the API never has to
 * send instants that the client would have to re-interpret in the store's zone. Buckets
 * without orders produce no row; they are filled in afterwards (see `trend.ts`).
 */
export function buildTrendPipeline(
  storeId: Types.ObjectId,
  range: ResolvedRange,
  granularity: Granularity,
): PipelineStage[] {
  const { timezone } = range;
  return [
    matchCountedOrders(storeId, range.current.from, range.current.to),
    addOrderCosts,
    {
      $group: {
        _id: {
          $dateToString: {
            date: { $dateTrunc: { date: '$processedAt', unit: granularity, timezone } },
            format: '%Y-%m-%d',
            timezone,
          },
        },
        ...PERIOD_SUM_ACCUMULATORS,
      },
    },
    { $sort: { _id: 1 } },
  ];
}
