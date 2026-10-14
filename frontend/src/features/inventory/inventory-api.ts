import { apiFetch } from '@/lib/api-client';
import { type DeadStockQuery, type DeadStockReport, PAGE_SIZE } from './types';

export const fetchDeadStock = (storeId: string, query: DeadStockQuery, signal?: AbortSignal) =>
  apiFetch<DeadStockReport>(`/stores/${storeId}/inventory/dead-stock`, {
    query: {
      window: query.window,
      sort: query.sort,
      direction: query.direction,
      page: query.page,
      pageSize: PAGE_SIZE,
    },
    signal,
  });
