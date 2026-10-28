import { apiFetch } from '@/lib/api-client';
import { type CustomerSegmentsQuery, type CustomerSegmentsReport, PAGE_SIZE } from './types';

export const fetchCustomerSegments = (
  storeId: string,
  query: CustomerSegmentsQuery,
  signal?: AbortSignal,
) =>
  apiFetch<CustomerSegmentsReport>(`/stores/${storeId}/customers/segments`, {
    query: {
      segment: query.segment,
      sort: query.sort,
      direction: query.direction,
      page: query.page,
      pageSize: PAGE_SIZE,
    },
    signal,
  });
