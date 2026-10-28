import { useSearchParams } from 'react-router';
import {
  CUSTOMER_SEGMENTS,
  CUSTOMER_SORTS,
  type CustomerSegment,
  type CustomerSegmentsQuery,
  type CustomerSort,
  DEFAULT_DIRECTION,
  DEFAULT_SORT,
  type SortDirection,
} from './types';

const DIRECTIONS: readonly SortDirection[] = ['asc', 'desc'];

function pick<T extends string>(allowed: readonly T[], value: string | null): T | undefined {
  return allowed.find((option) => option === value);
}

function parsePage(value: string | null): number {
  const page = Number(value);
  return Number.isInteger(page) && page >= 1 ? page : 1;
}

/**
 * The customers view state, kept in the URL (`?segment=AT_RISK&sort=orders&dir=asc&page=2`) so a
 * view can be shared and survives a reload. Unknown values fall back to the defaults; no
 * `segment` lists every customer. Changing the segment or the sort goes back to the first page.
 */
export function useCustomerParams() {
  const [searchParams, setSearchParams] = useSearchParams();

  const query: CustomerSegmentsQuery = {
    segment: pick(CUSTOMER_SEGMENTS, searchParams.get('segment')),
    sort: pick(CUSTOMER_SORTS, searchParams.get('sort')) ?? DEFAULT_SORT,
    direction: pick(DIRECTIONS, searchParams.get('dir')) ?? DEFAULT_DIRECTION,
    page: parsePage(searchParams.get('page')),
  };

  /** A null value removes the parameter. */
  function update(changes: Record<string, string | null>) {
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        for (const [key, value] of Object.entries(changes)) {
          if (value === null) next.delete(key);
          else next.set(key, value);
        }
        return next;
      },
      { replace: true },
    );
  }

  return {
    query,
    /** Undefined shows every customer. */
    setSegment: (segment: CustomerSegment | undefined) =>
      update({ segment: segment ?? null, page: '1' }),
    /** Sorting by the current column flips the direction; a new column starts descending. */
    setSort: (sort: CustomerSort) =>
      update({
        sort,
        dir: sort === query.sort && query.direction === 'desc' ? 'asc' : 'desc',
        page: '1',
      }),
    setPage: (page: number) => update({ page: String(page) }),
  };
}
