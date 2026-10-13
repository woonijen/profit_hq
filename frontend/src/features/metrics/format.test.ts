import { describe, expect, it } from 'vitest';
import {
  formatBucketDate,
  formatChange,
  formatInteger,
  formatMoney,
  formatPercent,
  formatPointsChange,
} from './format';

describe('formatMoney', () => {
  it('turns integer cents into currency, always with two decimals', () => {
    expect(formatMoney(123_456, 'USD')).toBe('$1,234.56');
    expect(formatMoney(5, 'USD')).toBe('$0.05');
    expect(formatMoney(0, 'USD')).toBe('$0.00');
    expect(formatMoney(-2500, 'USD')).toBe('-$25.00');
  });

  it('uses the store currency, not a hard-coded one', () => {
    expect(formatMoney(100_000, 'EUR')).toBe('€1,000.00');
  });

  it('abbreviates large amounts for chart axes', () => {
    expect(formatMoney(150_000_00, 'USD', true)).toBe('$150K');
    expect(formatMoney(1_234_000_00, 'USD', true)).toBe('$1.2M');
  });
});

describe('formatPercent', () => {
  it('shows one decimal', () => {
    expect(formatPercent(0.2534)).toBe('25.3%');
    expect(formatPercent(0)).toBe('0.0%');
    expect(formatPercent(-0.05)).toBe('-5.0%');
  });

  it('shows a dash when there is no ratio, e.g. a margin without revenue', () => {
    expect(formatPercent(null)).toBe('–');
  });
});

describe('formatInteger', () => {
  it('groups thousands', () => {
    expect(formatInteger(1051)).toBe('1,051');
  });
});

describe('formatChange', () => {
  it('signs the change and gives its direction', () => {
    expect(formatChange(0.1234)).toEqual({ text: '+12.3%', direction: 'up' });
    expect(formatChange(-0.5)).toEqual({ text: '-50.0%', direction: 'down' });
  });

  it('treats a change that rounds to zero as flat, whichever way it went', () => {
    expect(formatChange(0)).toEqual({ text: '0.0%', direction: 'flat' });
    expect(formatChange(0.0002)).toMatchObject({ direction: 'flat' });
    expect(formatChange(-0.0002)).toMatchObject({ direction: 'flat' });
  });

  it('has nothing to show when the previous period was zero', () => {
    expect(formatChange(null)).toBeNull();
  });
});

describe('formatPointsChange', () => {
  it('shows a margin change in percentage points, not percent', () => {
    expect(formatPointsChange(0.021)).toEqual({ text: '+2.1 pts', direction: 'up' });
    expect(formatPointsChange(-0.1)).toEqual({ text: '-10.0 pts', direction: 'down' });
    expect(formatPointsChange(0)).toEqual({ text: '0.0 pts', direction: 'flat' });
  });

  it('is empty when either margin is missing', () => {
    expect(formatPointsChange(null)).toBeNull();
  });
});

describe('formatBucketDate', () => {
  it('formats the store calendar date as given, never shifted by the browser time zone', () => {
    expect(formatBucketDate('2026-01-01', 'day')).toBe('Jan 1');
    expect(formatBucketDate('2026-12-31', 'day', true)).toBe('Dec 31, 2026');
  });

  it('names months, with the year', () => {
    expect(formatBucketDate('2026-02-01', 'month')).toBe('Feb 2026');
    expect(formatBucketDate('2026-02-01', 'month', true)).toBe('February 2026');
  });
});
