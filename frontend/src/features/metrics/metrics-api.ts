import { apiFetch } from '@/lib/api-client';
import type { Granularity, MetricsSummary, MetricsTrend, RangeKey } from './types';

export const fetchSummary = (storeId: string, range: RangeKey, signal?: AbortSignal) =>
  apiFetch<MetricsSummary>(`/stores/${storeId}/metrics/summary`, { query: { range }, signal });

export const fetchTrend = (
  storeId: string,
  range: RangeKey,
  granularity: Granularity,
  signal?: AbortSignal,
) =>
  apiFetch<MetricsTrend>(`/stores/${storeId}/metrics/trend`, {
    query: { range, granularity },
    signal,
  });
