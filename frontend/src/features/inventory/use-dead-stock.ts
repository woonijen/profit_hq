import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { fetchDeadStock } from './inventory-api';
import type { DeadStockQuery } from './types';

/** The dead-stock report of a store for one window, sort order and page. */
export function useDeadStock(storeId: string | undefined, query: DeadStockQuery) {
  return useQuery({
    queryKey: queryKeys.deadStock(storeId ?? '', query),
    queryFn: ({ signal }) => fetchDeadStock(storeId!, query, signal),
    enabled: storeId !== undefined,
    // Keep showing the old rows while another window or page loads.
    placeholderData: keepPreviousData,
  });
}
