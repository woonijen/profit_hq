import type { Types } from 'mongoose';
import { buildSummary, type MetricsSummary } from '../metrics/summary.js';
import { buildSummaryPipeline, type SummaryRow } from '../metrics/summary-pipeline.js';
import { Order } from '../models/order.model.js';
import type { StoreDoc } from '../models/store.model.js';
import type { RangeKey } from '../utils/date-range.js';
import { resolveRange } from '../utils/date-range.js';

type MetricsStore = Pick<StoreDoc, 'currency' | 'timezone'> & { _id: Types.ObjectId };

/** Dashboard numbers for the last `range` days of a store, with the previous period beside them. */
export async function getSummary(
  store: MetricsStore,
  range: RangeKey,
  now = new Date(),
): Promise<MetricsSummary> {
  const resolved = resolveRange(range, store.timezone, now);
  const rows = await Order.aggregate<SummaryRow>(buildSummaryPipeline(store._id, resolved));
  return buildSummary(rows, resolved, store.currency);
}
