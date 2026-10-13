export const RANGE_KEYS = ['7d', '30d', '90d'] as const;
export type RangeKey = (typeof RANGE_KEYS)[number];

/** A half-open interval `[from, to)` of instants. */
export interface Period {
  from: Date;
  to: Date;
}

export interface ResolvedRange {
  key: RangeKey;
  days: number;
  timezone: string;
  /** The last `days` calendar days in the store's time zone, ending with today. */
  current: Period;
  /** The same number of calendar days right before `current`. */
  previous: Period;
}

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let formatter = formatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
    });
    formatters.set(timeZone, formatter);
  }
  return formatter;
}

/** What the wall clock in `timeZone` reads at the given instant. */
function wallClock(instantMs: number, timeZone: string) {
  const parts = Object.fromEntries(
    formatterFor(timeZone)
      .formatToParts(new Date(instantMs))
      .map((part) => [part.type, Number(part.value)]),
  );
  return {
    year: parts.year ?? 0,
    month: parts.month ?? 0,
    day: parts.day ?? 0,
    hour: parts.hour ?? 0,
    minute: parts.minute ?? 0,
    second: parts.second ?? 0,
  };
}

/** How far the zone's wall clock is ahead of UTC at that instant, in ms (e.g. +5.5h for IST). */
function offsetMs(instantMs: number, timeZone: string): number {
  const c = wallClock(instantMs, timeZone);
  const wallAsUtc = Date.UTC(c.year, c.month - 1, c.day, c.hour, c.minute, c.second);
  return wallAsUtc - Math.floor(instantMs / 1000) * 1000;
}

/**
 * The instant at which `timeZone`'s wall clock reads 00:00 on the given date. `day` may fall
 * outside the month (0, -5, 35...); the calendar rolls over. The offset is looked up twice
 * because the zone's offset at midnight can differ from the one at the first guess (DST).
 */
function startOfLocalDay(year: number, month: number, day: number, timeZone: string): number {
  const nominal = Date.UTC(year, month - 1, day);
  const guess = nominal - offsetMs(nominal, timeZone);
  return nominal - offsetMs(guess, timeZone);
}

/**
 * Resolves `7d` / `30d` / `90d` into UTC bounds for the current and the previous period,
 * cut at midnight in the store's time zone. Today counts as a (partial) day of the current
 * period. `now` is injectable so results are reproducible.
 */
export function resolveRange(key: RangeKey, timeZone: string, now = new Date()): ResolvedRange {
  const days = Number.parseInt(key, 10);
  const { year, month, day } = wallClock(now.getTime(), timeZone);

  const at = (daysFromTodayStart: number) =>
    new Date(startOfLocalDay(year, month, day + daysFromTodayStart, timeZone));
  const end = at(1);
  const start = at(1 - days);

  return {
    key,
    days,
    timezone: timeZone,
    current: { from: start, to: end },
    previous: { from: at(1 - 2 * days), to: start },
  };
}
