import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { fetchLatestSync, startSyncRequest } from './sync-api';

/** How often the latest run is re-read while a sync is going on. */
const POLL_INTERVAL_MS = 1500;

/** The store's latest sync run (null if it never synced). Polls while `polling` is true. */
export function useSyncStatus(storeId: string | undefined, polling: boolean) {
  return useQuery({
    queryKey: queryKeys.latestSync(storeId ?? ''),
    queryFn: ({ signal }) => fetchLatestSync(storeId!, signal),
    enabled: storeId !== undefined,
    refetchInterval: polling ? POLL_INTERVAL_MS : false,
    // Always ask the server: a sync may have been started elsewhere.
    staleTime: 0,
  });
}

/** Asks the server to start a sync, and puts the new run into the status cache. */
export function useStartSync(storeId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => {
      if (!storeId) throw new Error('No store to sync');
      return startSyncRequest(storeId);
    },
    onSuccess: ({ run }) => {
      if (storeId) queryClient.setQueryData(queryKeys.latestSync(storeId), { run });
    },
  });
}
