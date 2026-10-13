import { describe, expect, it } from 'vitest';
import { resolveRange } from '../utils/date-range.js';
import { buildTrend } from './trend.js';
import type { TrendRow } from './trend-pipeline.js';

const row = (date: string, overrides: Partial<TrendRow> = {}): TrendRow => ({
  _id: date,
  orders: 1,
  grossCents: 1000,
  discountCents: 0,
  refundedCents: 0,
  taxCents: 0,
  cogsCents: 400,
  costedGrossCents: 1000,
  ...overrides,
});

const dates = (trend: ReturnType<typeof buildTrend>) => trend.points.map((p) => p.date);

describe('buildTrend, daily', () => {
  const range = resolveRange('7d', 'UTC', new Date('2026-01-15T12:00:00Z'));

  it('fills days without orders with zeros so the series is continuous', () => {
    const trend = buildTrend([row('2026-01-10'), row('2026-01-13')], range, 'day', 'USD');

    expect(dates(trend)).toEqual([
      '2026-01-09',
      '2026-01-10',
      '2026-01-11',
      '2026-01-12',
      '2026-01-13',
      '2026-01-14',
      '2026-01-15',
    ]);
    expect(trend.points[0]).toEqual({
      date: '2026-01-09',
      orders: 0,
      grossRevenueCents: 0,
      netRevenueCents: 0,
      cogsCents: 0,
      netProfitCents: 0,
      netMargin: null,
      partial: false,
    });
  });

  it('derives revenue, COGS, profit and margin per bucket like the summary does', () => {
    // Net revenue 2000 − 200 − 300 = 1500, profit 1500 − 600 = 900.
    const busy = row('2026-01-12', {
      orders: 2,
      grossCents: 2000,
      discountCents: 200,
      refundedCents: 300,
      cogsCents: 600,
    });
    const { points } = buildTrend([busy], range, 'day', 'USD');

    expect(points.find((p) => p.date === '2026-01-12')).toMatchObject({
      orders: 2,
      grossRevenueCents: 2000,
      netRevenueCents: 1500,
      cogsCents: 600,
      netProfitCents: 900,
      netMargin: 0.6,
    });
  });

  it('gives a fully refunded day no margin instead of dividing by zero', () => {
    const refunded = row('2026-01-11', { grossCents: 1000, refundedCents: 1000, cogsCents: 0 });
    const { points } = buildTrend([refunded], range, 'day', 'USD');

    expect(points.find((p) => p.date === '2026-01-11')).toMatchObject({
      netRevenueCents: 0,
      netMargin: null,
    });
  });

  it('returns a full run of empty days for a store without orders', () => {
    const trend = buildTrend(
      [],
      resolveRange('90d', 'UTC', new Date('2026-03-01T00:00:00Z')),
      'day',
      'USD',
    );

    expect(trend.points).toHaveLength(90);
    expect(trend.points.every((p) => p.orders === 0)).toBe(true);
    expect(trend.points[0]?.date).toBe('2025-12-02');
    expect(trend.points[89]?.date).toBe('2026-03-01');
  });

  it('describes the range it covers', () => {
    const trend = buildTrend([], range, 'day', 'EUR');
    expect(trend).toMatchObject({
      granularity: 'day',
      range: {
        key: '7d',
        timezone: 'UTC',
        currency: 'EUR',
        from: '2026-01-09T00:00:00.000Z',
        to: '2026-01-16T00:00:00.000Z',
      },
    });
  });
});

describe('buildTrend, time zones', () => {
  it('names days by the store calendar, with no skipped or doubled day across a DST change', () => {
    // New York springs forward on Mar 8, so Mar 8 is only 23 hours long.
    const range = resolveRange('7d', 'America/New_York', new Date('2026-03-10T03:00:00Z'));
    const trend = buildTrend([], range, 'day', 'USD');

    // 03:00Z on Mar 10 is still Mar 9 in New York, so the week ends on Mar 9.
    expect(dates(trend)).toEqual([
      '2026-03-03',
      '2026-03-04',
      '2026-03-05',
      '2026-03-06',
      '2026-03-07',
      '2026-03-08',
      '2026-03-09',
    ]);
  });

  it('starts on the store date even when UTC is already a day ahead', () => {
    // 23:30Z on Jan 15 is Jan 16 in Auckland, so the week is Jan 10–16 there.
    const range = resolveRange('7d', 'Pacific/Auckland', new Date('2026-01-15T23:30:00Z'));
    const trend = buildTrend([], range, 'day', 'NZD');

    expect(trend.points[0]?.date).toBe('2026-01-10');
    expect(trend.points[6]?.date).toBe('2026-01-16');
  });
});

describe('buildTrend, monthly', () => {
  it('has one bucket per month the range touches, with the edge months marked partial', () => {
    // 30d ending Jan 15: Dec 17 – Jan 15.
    const range = resolveRange('30d', 'UTC', new Date('2026-01-15T12:00:00Z'));
    const trend = buildTrend([row('2025-12-01'), row('2026-01-01')], range, 'month', 'USD');

    expect(trend.granularity).toBe('month');
    expect(trend.points.map((p) => [p.date, p.partial, p.orders])).toEqual([
      ['2025-12-01', true, 1],
      ['2026-01-01', true, 1],
    ]);
  });

  it('fills a month without orders and does not mark a fully covered month partial', () => {
    // 90d ending Mar 31 2026 starts Jan 1, so Jan and Feb are covered entirely and so is March.
    const range = resolveRange('90d', 'UTC', new Date('2026-03-31T12:00:00Z'));
    const trend = buildTrend([row('2026-01-01'), row('2026-03-01')], range, 'month', 'USD');

    expect(trend.points.map((p) => [p.date, p.partial, p.orders])).toEqual([
      ['2026-01-01', false, 1],
      ['2026-02-01', false, 0],
      ['2026-03-01', false, 1],
    ]);
  });

  it('marks the month that is still running as partial', () => {
    const range = resolveRange('90d', 'UTC', new Date('2026-03-15T12:00:00Z'));
    const trend = buildTrend([], range, 'month', 'USD');

    // Dec 17 – Mar 15 touches four months; both ends are cut.
    expect(trend.points.map((p) => [p.date, p.partial])).toEqual([
      ['2025-12-01', true],
      ['2026-01-01', false],
      ['2026-02-01', false],
      ['2026-03-01', true],
    ]);
  });

  it('uses the store calendar to decide which month a range starts in', () => {
    // 07:30Z on Feb 1 is still Jan 31 in Los Angeles, so a 7d range ends on Jan 31 there.
    const range = resolveRange('7d', 'America/Los_Angeles', new Date('2026-02-01T07:30:00Z'));
    const trend = buildTrend([], range, 'month', 'USD');

    expect(trend.points.map((p) => p.date)).toEqual(['2026-01-01']);
  });
});
