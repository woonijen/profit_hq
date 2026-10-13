import type { Granularity } from './types';

const moneyFormatters = new Map<string, Intl.NumberFormat>();

function moneyFormatter(currency: string, compact: boolean) {
  const key = `${currency}:${compact}`;
  let formatter = moneyFormatters.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      ...(compact
        ? { notation: 'compact', maximumFractionDigits: 1 }
        : { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    });
    moneyFormatters.set(key, formatter);
  }
  return formatter;
}

/** Integer cents → "$1,234.56" (or "$1.2K" with `compact`, for axes). */
export function formatMoney(cents: number, currency: string, compact = false): string {
  return moneyFormatter(currency, compact).format(cents / 100);
}

const percentFormatter = new Intl.NumberFormat(undefined, {
  style: 'percent',
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/** 0.2534 → "25.3%". Null (no revenue to take a margin of) → an en dash. */
export function formatPercent(ratio: number | null): string {
  return ratio === null ? '–' : percentFormatter.format(ratio);
}

const integerFormatter = new Intl.NumberFormat();
export const formatInteger = (value: number) => integerFormatter.format(value);

export type Direction = 'up' | 'down' | 'flat';

export interface Delta {
  text: string;
  direction: Direction;
}

const deltaFormatter = new Intl.NumberFormat(undefined, {
  style: 'percent',
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
  signDisplay: 'exceptZero',
});

/** `percent` is in percent units. A change that rounds to 0.0 reads as flat, whatever its sign. */
const directionOf = (percent: number): Direction =>
  Math.abs(percent) < 0.05 ? 'flat' : percent > 0 ? 'up' : 'down';

/** Relative change against the previous period. Null when the previous period was 0. */
export function formatChange(changeRatio: number | null): Delta | null {
  if (changeRatio === null) return null;
  const text = deltaFormatter.format(changeRatio);
  return { text, direction: directionOf(changeRatio * 100) };
}

const pointsFormatter = new Intl.NumberFormat(undefined, {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
  signDisplay: 'exceptZero',
});

/** Change of a margin, in percentage points: 0.021 → "+2.1 pts". */
export function formatPointsChange(deltaPoints: number | null): Delta | null {
  if (deltaPoints === null) return null;
  const text = `${pointsFormatter.format(deltaPoints * 100)} pts`;
  return { text, direction: directionOf(deltaPoints * 100) };
}

/**
 * Chart label for a bucket date. The API sends the store's calendar date, so it is formatted in
 * UTC: converting it to the browser's zone could shift it by a day.
 */
export function formatBucketDate(date: string, granularity: Granularity, long = false): string {
  const options: Intl.DateTimeFormatOptions =
    granularity === 'month'
      ? { month: long ? 'long' : 'short', year: 'numeric' }
      : { month: 'short', day: 'numeric', year: long ? 'numeric' : undefined };
  return new Intl.DateTimeFormat(undefined, { ...options, timeZone: 'UTC' }).format(
    new Date(`${date}T00:00:00Z`),
  );
}
