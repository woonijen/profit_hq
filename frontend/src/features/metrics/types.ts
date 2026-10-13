/** Mirrors the backend responses of `/stores/:id/metrics/*` (see docs/metrics.md). */

export const RANGE_KEYS = ['7d', '30d', '90d'] as const;
export type RangeKey = (typeof RANGE_KEYS)[number];

export const GRANULARITIES = ['day', 'month'] as const;
export type Granularity = (typeof GRANULARITIES)[number];

export const DEFAULT_RANGE: RangeKey = '30d';
export const DEFAULT_GRANULARITY: Granularity = 'day';

/** A metric for both periods. `changeRatio` is relative (0.1 = up 10%); null if previous is 0. */
export interface Comparison {
  current: number;
  previous: number;
  changeRatio: number | null;
}

export interface MarginComparison {
  current: number | null;
  previous: number | null;
  /** current − previous, e.g. 0.02 = +2 points. */
  deltaPoints: number | null;
}

export interface MetricsSummary {
  range: {
    key: RangeKey;
    timezone: string;
    currency: string;
    current: { from: string; to: string };
    previous: { from: string; to: string };
  };
  /** Money fields are integer cents in `range.currency`. */
  metrics: {
    grossRevenueCents: Comparison;
    discountsCents: Comparison;
    refundsCents: Comparison;
    netRevenueCents: Comparison;
    taxesCents: Comparison;
    cogsCents: Comparison;
    netProfitCents: Comparison;
    orders: Comparison;
    aovCents: Comparison;
    netMargin: MarginComparison;
  };
  /** Share of gross revenue on lines with a known cost, 0–1. Below 1, profit is overstated. */
  costCoverage: { current: number; previous: number };
}

export interface TrendPoint {
  /** Local calendar date the bucket starts on, `YYYY-MM-DD` (the 1st for months). */
  date: string;
  orders: number;
  grossRevenueCents: number;
  netRevenueCents: number;
  cogsCents: number;
  netProfitCents: number;
  /** Null when the bucket has no net revenue. */
  netMargin: number | null;
  /** A month bucket that covers only part of its month inside the range. */
  partial: boolean;
}

export interface MetricsTrend {
  range: { key: RangeKey; timezone: string; currency: string; from: string; to: string };
  granularity: Granularity;
  points: TrendPoint[];
}
