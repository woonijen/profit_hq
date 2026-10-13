import type { ResolvedRange } from '../utils/date-range.js';
import type { PeriodSums } from './period-sums.js';
import type { SummaryRow } from './summary-pipeline.js';

/** A metric for both periods. `changeRatio` is relative (0.1 = up 10%); null if previous is 0. */
export interface Comparison {
  current: number;
  previous: number;
  changeRatio: number | null;
}

/** Net margin for both periods. `deltaPoints` is current − previous, e.g. 0.02 = +2 points. */
export interface MarginComparison {
  current: number | null;
  previous: number | null;
  deltaPoints: number | null;
}

export interface MetricsSummary {
  range: {
    key: string;
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

export const EMPTY_SUMS: PeriodSums = {
  orders: 0,
  grossCents: 0,
  discountCents: 0,
  refundedCents: 0,
  taxCents: 0,
  cogsCents: 0,
  costedGrossCents: 0,
};

/** Every metric of one period, derived from its summed totals (docs/metrics.md). */
export function deriveTotals(row: PeriodSums = EMPTY_SUMS) {
  const netRevenue = row.grossCents - row.discountCents - row.refundedCents;
  const netProfit = netRevenue - row.cogsCents;
  return {
    grossRevenue: row.grossCents,
    discounts: row.discountCents,
    refunds: row.refundedCents,
    netRevenue,
    taxes: row.taxCents,
    cogs: row.cogsCents,
    netProfit,
    orders: row.orders,
    aov: row.orders > 0 ? Math.round(netRevenue / row.orders) : 0,
    netMargin: netRevenue !== 0 ? netProfit / netRevenue : null,
    costCoverage: row.grossCents > 0 ? row.costedGrossCents / row.grossCents : 1,
  };
}

function compare(current: number, previous: number): Comparison {
  return {
    current,
    previous,
    changeRatio: previous === 0 ? null : (current - previous) / Math.abs(previous),
  };
}

function compareMargin(current: number | null, previous: number | null): MarginComparison {
  return {
    current,
    previous,
    deltaPoints: current !== null && previous !== null ? current - previous : null,
  };
}

/** Turns the pipeline's rows (a period with no orders has no row) into the API response. */
export function buildSummary(
  rows: readonly SummaryRow[],
  range: ResolvedRange,
  currency: string,
): MetricsSummary {
  const cur = deriveTotals(rows.find((row) => row._id === 'current'));
  const prev = deriveTotals(rows.find((row) => row._id === 'previous'));

  return {
    range: {
      key: range.key,
      timezone: range.timezone,
      currency,
      current: {
        from: range.current.from.toISOString(),
        to: range.current.to.toISOString(),
      },
      previous: {
        from: range.previous.from.toISOString(),
        to: range.previous.to.toISOString(),
      },
    },
    metrics: {
      grossRevenueCents: compare(cur.grossRevenue, prev.grossRevenue),
      discountsCents: compare(cur.discounts, prev.discounts),
      refundsCents: compare(cur.refunds, prev.refunds),
      netRevenueCents: compare(cur.netRevenue, prev.netRevenue),
      taxesCents: compare(cur.taxes, prev.taxes),
      cogsCents: compare(cur.cogs, prev.cogs),
      netProfitCents: compare(cur.netProfit, prev.netProfit),
      orders: compare(cur.orders, prev.orders),
      aovCents: compare(cur.aov, prev.aov),
      netMargin: compareMargin(cur.netMargin, prev.netMargin),
    },
    costCoverage: { current: cur.costCoverage, previous: prev.costCoverage },
  };
}
