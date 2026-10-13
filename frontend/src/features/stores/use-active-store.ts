import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { fetchStores } from './stores-api';

/**
 * The store the dashboard shows. An account has exactly one store for now (created on first
 * request), so this is the first one; a store switcher would replace it.
 */
export function useActiveStore() {
  const query = useQuery({
    queryKey: queryKeys.stores,
    queryFn: fetchStores,
    staleTime: Infinity,
    select: (data) => data.stores[0] ?? null,
  });
  return {
    store: query.data ?? null,
    isPending: query.isPending,
    error: query.error,
    refetch: query.refetch,
  };
}
