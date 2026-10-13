import { describe, expect, it } from 'vitest';
import { resolveRange } from './date-range.js';

const iso = (range: { from: Date; to: Date }) => [range.from.toISOString(), range.to.toISOString()];

describe('resolveRange', () => {
  it('cuts at UTC midnight for a UTC store, with today as the last (partial) day', () => {
    const range = resolveRange('7d', 'UTC', new Date('2026-01-15T12:00:00Z'));
    expect(iso(range.current)).toEqual(['2026-01-09T00:00:00.000Z', '2026-01-16T00:00:00.000Z']);
    expect(iso(range.previous)).toEqual(['2026-01-02T00:00:00.000Z', '2026-01-09T00:00:00.000Z']);
    expect(range).toMatchObject({ key: '7d', days: 7, timezone: 'UTC' });
  });

  it('supports 30 and 90 days, rolling over months and years', () => {
    const thirty = resolveRange('30d', 'UTC', new Date('2026-01-15T12:00:00Z'));
    expect(iso(thirty.current)).toEqual(['2025-12-17T00:00:00.000Z', '2026-01-16T00:00:00.000Z']);
    expect(iso(thirty.previous)).toEqual(['2025-11-17T00:00:00.000Z', '2025-12-17T00:00:00.000Z']);

    const ninety = resolveRange('90d', 'UTC', new Date('2026-03-01T00:00:00Z'));
    expect(ninety.current.from.toISOString()).toBe('2025-12-02T00:00:00.000Z');
    expect(ninety.previous.from.toISOString()).toBe('2025-09-03T00:00:00.000Z');
  });

  it('uses the store zone to decide which day it is', () => {
    // 23:30 UTC on Jan 15 is already Jan 16 in Auckland (UTC+13 in January).
    const range = resolveRange('7d', 'Pacific/Auckland', new Date('2026-01-15T23:30:00Z'));
    expect(iso(range.current)).toEqual(['2026-01-09T11:00:00.000Z', '2026-01-16T11:00:00.000Z']);
  });

  it('handles zones with a half-hour offset', () => {
    // 20:00 UTC is 01:30 on Jan 16 in India (UTC+5:30).
    const range = resolveRange('7d', 'Asia/Kolkata', new Date('2026-01-15T20:00:00Z'));
    expect(iso(range.current)).toEqual(['2026-01-09T18:30:00.000Z', '2026-01-16T18:30:00.000Z']);
  });

  it('keeps midnight-aligned bounds across a DST change', () => {
    // New York springs forward on Mar 8: midnight is 05:00Z before it and 04:00Z after.
    const range = resolveRange('7d', 'America/New_York', new Date('2026-03-10T03:00:00Z'));
    expect(iso(range.current)).toEqual(['2026-03-03T05:00:00.000Z', '2026-03-10T04:00:00.000Z']);
    expect(range.previous.from.toISOString()).toBe('2026-02-24T05:00:00.000Z');
  });

  it('makes the two periods touch with no gap and no overlap', () => {
    const range = resolveRange('30d', 'America/Los_Angeles', new Date('2026-06-01T10:00:00Z'));
    expect(range.previous.to.getTime()).toBe(range.current.from.getTime());
  });
});
