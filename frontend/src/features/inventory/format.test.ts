import { describe, expect, it } from 'vitest';
import { formatDays, formatLastSold } from './format';

describe('formatDays', () => {
  it('uses the singular for one day only', () => {
    expect(formatDays(1)).toBe('1 day');
    expect(formatDays(0)).toBe('0 days');
    expect(formatDays(45)).toBe('45 days');
  });
});

describe('formatLastSold', () => {
  it('says "Never" for a variant that never sold', () => {
    expect(formatLastSold(null)).toBe('Never');
  });

  it('formats the date (the exact text depends on the locale)', () => {
    expect(formatLastSold('2026-01-15T12:00:00.000Z')).toMatch(/2026/);
  });
});
