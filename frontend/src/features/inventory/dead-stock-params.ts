import { useSearchParams } from 'react-router';
import {
  DEAD_STOCK_SORTS,
  DEAD_STOCK_WINDOWS,
  DEFAULT_DIRECTION,
  DEFAULT_SORT,
  DEFAULT_WINDOW,
  type DeadStockQuery,
  type DeadStockSort,
  type DeadStockWindow,
  type SortDirection,
} from './types';

const DIRECTIONS: readonly SortDirection[] = ['asc', 'desc'];

function pick<T extends string | number>(
  allowed: readonly T[],
  value: string | null,
  fallback: T,
): T {
  return allowed.find((option) => String(option) === value) ?? fallback;
}

function parsePage(value: string | null): number {
  const page = Number(value);
  return Number.isInteger(page) && page >= 1 ? page : 1;
}

/**
 * The dead-stock view state, kept in the URL (`?window=60&sort=stockValue&dir=desc&page=2`) so
 * a view can be shared and survives a reload. Unknown values fall back to the defaults.
 * Changing the window or the sort goes back to the first page.
 */
export function useDeadStockParams() {
  const [searchParams, setSearchParams] = useSearchParams();

  const query: DeadStockQuery = {
    window: pick(DEAD_STOCK_WINDOWS, searchParams.get('window'), DEFAULT_WINDOW),
    sort: pick(DEAD_STOCK_SORTS, searchParams.get('sort'), DEFAULT_SORT),
    direction: pick(DIRECTIONS, searchParams.get('dir'), DEFAULT_DIRECTION),
    page: parsePage(searchParams.get('page')),
  };

  function update(changes: Record<string, string>) {
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        for (const [key, value] of Object.entries(changes)) next.set(key, value);
        return next;
      },
      { replace: true },
    );
  }

  return {
    query,
    setWindow: (window: DeadStockWindow) => update({ window: String(window), page: '1' }),
    /** Sorting by the current column flips the direction; a new column starts descending. */
    setSort: (sort: DeadStockSort) =>
      update({
        sort,
        dir: sort === query.sort && query.direction === 'desc' ? 'asc' : 'desc',
        page: '1',
      }),
    setPage: (page: number) => update({ page: String(page) }),
  };
}
