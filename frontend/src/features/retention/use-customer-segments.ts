import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { fetchCustomerSegments } from './retention-api';
import type { CustomerSegmentsQuery } from './types';

/** The customer segments report of a store for one segment filter, sort order and page. */
export function useCustomerSegments(storeId: string | undefined, query: CustomerSegmentsQuery) {
  return useQuery({
    queryKey: queryKeys.customerSegments(storeId ?? '', query),
    queryFn: ({ signal }) => fetchCustomerSegments(storeId!, query, signal),
    enabled: storeId !== undefined,
    // Keep showing the old rows while another segment or page loads.
    placeholderData: keepPreviousData,
  });
}
