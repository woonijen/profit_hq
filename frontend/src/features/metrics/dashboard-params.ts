import { useSearchParams } from 'react-router';
import {
  DEFAULT_GRANULARITY,
  DEFAULT_RANGE,
  GRANULARITIES,
  type Granularity,
  RANGE_KEYS,
  type RangeKey,
} from './types';

function pick<T extends string>(allowed: readonly T[], value: string | null, fallback: T): T {
  return allowed.find((option) => option === value) ?? fallback;
}

/**
 * The dashboard filters, kept in the URL (`?range=7d&granularity=month`) so a view can be
 * shared, bookmarked and survives a reload. Unknown values fall back to the defaults.
 */
export function useDashboardParams() {
  const [searchParams, setSearchParams] = useSearchParams();
  const range = pick(RANGE_KEYS, searchParams.get('range'), DEFAULT_RANGE);
  const granularity = pick(GRANULARITIES, searchParams.get('granularity'), DEFAULT_GRANULARITY);

  function update(key: 'range' | 'granularity', value: RangeKey | Granularity) {
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.set(key, value);
        return next;
      },
      { replace: true },
    );
  }

  return {
    range,
    granularity,
    setRange: (value: RangeKey) => update('range', value),
    setGranularity: (value: Granularity) => update('granularity', value),
  };
}
