import { localDate, type ResolvedRange } from '../utils/date-range.js';
import { deriveTotals } from './summary.js';
import type { Granularity, TrendRow } from './trend-pipeline.js';

/** One day or month of the series. Money in integer cents of `range.currency`. */
export interface TrendPoint {
  /** Local calendar date the bucket starts on, `YYYY-MM-DD` (the 1st for months). */
  date: string;
  orders: number;
  grossRevenueCents: number;
  netRevenueCents: number;
  cogsCents: number;
  netProfitCents: number;
  /** Null when the bucket has no net revenue (always so for an empty bucket). */
  netMargin: number | null;
  /** True for a month bucket that covers only part of its month inside the range. */
  partial: boolean;
}

export interface MetricsTrend {
  range: { key: string; timezone: string; currency: string; from: string; to: string };
  granularity: Granularity;
  /** One point per day or month of the range, in order, with no gaps. */
  points: TrendPoint[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

const dateKey = (utcMs: number) => new Date(utcMs).toISOString().slice(0, 10);

/**
 * The buckets that cover the range. Calendar dates are pure arithmetic, so they are worked out
 * on UTC timestamps standing in for dates, not on real instants; that keeps DST out of it.
 */
function bucketsFor(range: ResolvedRange, granularity: Granularity) {
  const first = localDate(range.current.from, range.timezone);
  const startMs = Date.UTC(first.year, first.month - 1, first.day);
  const endMs = startMs + range.days * DAY_MS; // exclusive

  if (granularity === 'day') {
    return Array.from({ length: range.days }, (_, i) => ({
      date: dateKey(startMs + i * DAY_MS),
      partial: false,
    }));
  }

  const buckets: { date: string; partial: boolean }[] = [];
  const firstMonthMs = Date.UTC(first.year, first.month - 1, 1);
  for (let monthMs = firstMonthMs; monthMs < endMs;) {
    const month = new Date(monthMs);
    const nextMs = Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 1);
    buckets.push({ date: dateKey(monthMs), partial: monthMs < startMs || nextMs > endMs });
    monthMs = nextMs;
  }
  return buckets;
}

/**
 * Turns the pipeline's rows into a continuous series: every day (or month) of the range gets a
 * point, with zeros where nothing was sold, so a chart never has to guess at missing days.
 */
export function buildTrend(
  rows: readonly TrendRow[],
  range: ResolvedRange,
  granularity: Granularity,
  currency: string,
): MetricsTrend {
  const sumsByDate = new Map(rows.map((row) => [row._id, row]));

  const points = bucketsFor(range, granularity).map(({ date, partial }): TrendPoint => {
    const totals = deriveTotals(sumsByDate.get(date));
    return {
      date,
      orders: totals.orders,
      grossRevenueCents: totals.grossRevenue,
      netRevenueCents: totals.netRevenue,
      cogsCents: totals.cogs,
      netProfitCents: totals.netProfit,
      netMargin: totals.netMargin,
      partial,
    };
  });

  return {
    range: {
      key: range.key,
      timezone: range.timezone,
      currency,
      from: range.current.from.toISOString(),
      to: range.current.to.toISOString(),
    },
    granularity,
    points,
  };
}
