import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { fetchSummary, fetchTrend } from './metrics-api';
import type { Granularity, RangeKey } from './types';

/** Summary cards of the last `range` days, with the previous period beside them. */
export function useSummary(storeId: string | undefined, range: RangeKey) {
  return useQuery({
    queryKey: queryKeys.summary(storeId ?? '', range),
    queryFn: ({ signal }) => fetchSummary(storeId!, range, signal),
    enabled: storeId !== undefined,
    // Keep showing the old range while the new one loads, instead of flashing a skeleton.
    placeholderData: keepPreviousData,
  });
}

/** Revenue / margin series for the chart. */
export function useTrend(storeId: string | undefined, range: RangeKey, granularity: Granularity) {
  return useQuery({
    queryKey: queryKeys.trend(storeId ?? '', range, granularity),
    queryFn: ({ signal }) => fetchTrend(storeId!, range, granularity, signal),
    enabled: storeId !== undefined,
    placeholderData: keepPreviousData,
  });
}
