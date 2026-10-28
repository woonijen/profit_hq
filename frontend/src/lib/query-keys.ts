import type { DeadStockQuery } from '@/features/inventory/types';
import type { Granularity, RangeKey } from '@/features/metrics/types';
import type { CustomerSegmentsQuery } from '@/features/retention/types';

/** One place for TanStack Query keys, so invalidating a prefix reaches everything under it. */
export const queryKeys = {
  stores: ['stores'] as const,
  /** Prefix of every dashboard query of a store: invalidate this after a sync. */
  storeMetrics: (storeId: string) => ['stores', storeId, 'metrics'] as const,
  summary: (storeId: string, range: RangeKey) =>
    ['stores', storeId, 'metrics', 'summary', range] as const,
  trend: (storeId: string, range: RangeKey, granularity: Granularity) =>
    ['stores', storeId, 'metrics', 'trend', range, granularity] as const,
  /** Prefix of every inventory query of a store: invalidate this after a sync. */
  storeInventory: (storeId: string) => ['stores', storeId, 'inventory'] as const,
  deadStock: (storeId: string, query: DeadStockQuery) =>
    [
      'stores',
      storeId,
      'inventory',
      'dead-stock',
      query.window,
      query.sort,
      query.direction,
      query.page,
    ] as const,
  /** Prefix of every customer retention query of a store: invalidate this after a sync. */
  storeRetention: (storeId: string) => ['stores', storeId, 'retention'] as const,
  customerSegments: (storeId: string, query: CustomerSegmentsQuery) =>
    [
      'stores',
      storeId,
      'retention',
      'segments',
      query.segment ?? 'all',
      query.sort,
      query.direction,
      query.page,
    ] as const,
  latestSync: (storeId: string) => ['stores', storeId, 'sync', 'latest'] as const,
};
