import { describe, expect, it } from 'vitest';
import { resolveRange } from '../utils/date-range.js';
import { buildSummary } from './summary.js';
import type { SummaryRow } from './summary-pipeline.js';

const range = resolveRange('7d', 'UTC', new Date('2026-01-15T12:00:00Z'));

// Hand-computed: net revenue 10000 − 500 − 1500 = 8000, COGS 3000, profit 5000, 4 orders.
const current: SummaryRow = {
  _id: 'current',
  orders: 4,
  grossCents: 10_000,
  discountCents: 500,
  refundedCents: 1500,
  taxCents: 800,
  cogsCents: 3000,
  costedGrossCents: 8000,
};
// Net revenue 4000, COGS 2000, profit 2000, 2 orders.
const previous: SummaryRow = {
  _id: 'previous',
  orders: 2,
  grossCents: 4000,
  discountCents: 0,
  refundedCents: 0,
  taxCents: 300,
  cogsCents: 2000,
  costedGrossCents: 4000,
};

describe('buildSummary', () => {
  it('derives every metric from the summed totals', () => {
    const { metrics, costCoverage } = buildSummary([current, previous], range, 'USD');

    expect(metrics.grossRevenueCents).toMatchObject({ current: 10_000, previous: 4000 });
    expect(metrics.netRevenueCents).toMatchObject({ current: 8000, previous: 4000 });
    expect(metrics.cogsCents.current).toBe(3000);
    expect(metrics.netProfitCents).toMatchObject({ current: 5000, previous: 2000 });
    expect(metrics.aovCents).toMatchObject({ current: 2000, previous: 2000 });
    expect(metrics.taxesCents.current).toBe(800);
    expect(metrics.netMargin.current).toBeCloseTo(0.625); // 5000 / 8000
    expect(metrics.netMargin.previous).toBeCloseTo(0.5);
    expect(costCoverage.current).toBeCloseTo(0.8); // 8000 / 10000
  });

  it('reports changes relative to the previous period, and margin in points', () => {
    const { metrics } = buildSummary([current, previous], range, 'USD');

    expect(metrics.netRevenueCents.changeRatio).toBeCloseTo(1); // 4000 → 8000
    expect(metrics.netProfitCents.changeRatio).toBeCloseTo(1.5); // 2000 → 5000
    expect(metrics.orders.changeRatio).toBeCloseTo(1); // 2 → 4
    expect(metrics.netMargin.deltaPoints).toBeCloseTo(0.125);
  });

  it('rounds AOV to a whole cent', () => {
    const row: SummaryRow = {
      ...current,
      orders: 3,
      grossCents: 1000,
      discountCents: 0,
      refundedCents: 0,
    };
    expect(buildSummary([row], range, 'USD').metrics.aovCents.current).toBe(333);
  });

  it('treats a period without orders as zeros, with no divide-by-zero', () => {
    const { metrics, costCoverage } = buildSummary([current], range, 'USD');

    expect(metrics.netRevenueCents.previous).toBe(0);
    expect(metrics.aovCents.previous).toBe(0);
    expect(metrics.netMargin).toMatchObject({ previous: null, deltaPoints: null });
    expect(metrics.netRevenueCents.changeRatio).toBeNull();
    expect(costCoverage.previous).toBe(1);
  });

  it('copes with no orders at all', () => {
    const { metrics } = buildSummary([], range, 'USD');
    expect(metrics.netProfitCents).toEqual({ current: 0, previous: 0, changeRatio: null });
    expect(metrics.netMargin.current).toBeNull();
  });

  it('uses the absolute previous value so a loss turning into profit reads as growth', () => {
    const loss: SummaryRow = {
      ...previous,
      grossCents: 1000,
      cogsCents: 3000,
      costedGrossCents: 1000,
    };
    // previous profit = 1000 − 3000 = −2000; current 5000 → (5000 + 2000) / 2000
    expect(
      buildSummary([current, loss], range, 'USD').metrics.netProfitCents.changeRatio,
    ).toBeCloseTo(3.5);
  });

  it('describes the range it was computed for', () => {
    const { range: described } = buildSummary([], range, 'EUR');
    expect(described).toEqual({
      key: '7d',
      timezone: 'UTC',
      currency: 'EUR',
      current: { from: '2026-01-09T00:00:00.000Z', to: '2026-01-16T00:00:00.000Z' },
      previous: { from: '2026-01-02T00:00:00.000Z', to: '2026-01-09T00:00:00.000Z' },
    });
  });
});
