import type { Granularity, RangeKey } from '@/features/metrics/types';

/** One place for TanStack Query keys, so invalidating a prefix reaches everything under it. */
export const queryKeys = {
  stores: ['stores'] as const,
  /** Prefix of every dashboard query of a store: invalidate this after a sync. */
  storeMetrics: (storeId: string) => ['stores', storeId, 'metrics'] as const,
  summary: (storeId: string, range: RangeKey) =>
    ['stores', storeId, 'metrics', 'summary', range] as const,
  trend: (storeId: string, range: RangeKey, granularity: Granularity) =>
    ['stores', storeId, 'metrics', 'trend', range, granularity] as const,
  latestSync: (storeId: string) => ['stores', storeId, 'sync', 'latest'] as const,
};
