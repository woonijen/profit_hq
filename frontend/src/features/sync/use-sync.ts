import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useReducer } from 'react';
import { ApiError } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { initialSyncState, syncReducer } from './sync-machine';
import { useStartSync, useSyncStatus } from './use-sync-queries';

/** How long the success message stays before the button goes back to idle. */
const SUCCESS_RESET_MS = 5000;

/**
 * Everything the UI needs about syncing: the state machine, the latest run, and `start`.
 * When a sync ends, the dashboard queries of the store are invalidated so the numbers refresh.
 */
export function useSync(storeId: string | undefined) {
  const queryClient = useQueryClient();
  const [state, dispatch] = useReducer(syncReducer, initialSyncState);
  const status = useSyncStatus(storeId, state.status === 'syncing');
  const startSync = useStartSync(storeId);

  const latest = status.data;
  useEffect(() => {
    if (latest) dispatch({ type: 'run-observed', run: latest.run });
  }, [latest]);

  const finishedRun = state.status === 'success' || state.status === 'error' ? state.run : null;
  useEffect(() => {
    // A failed run may still have written some pages, so refresh in that case too.
    if (storeId && finishedRun) {
      void queryClient.invalidateQueries({ queryKey: queryKeys.storeMetrics(storeId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.storeInventory(storeId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.storeRetention(storeId) });
    }
  }, [queryClient, storeId, finishedRun]);

  useEffect(() => {
    if (state.status !== 'success') return;
    const timer = setTimeout(() => dispatch({ type: 'dismiss' }), SUCCESS_RESET_MS);
    return () => clearTimeout(timer);
  }, [state.status]);

  function start() {
    if (!storeId || state.status === 'syncing') return;
    dispatch({ type: 'start-requested' });
    startSync.mutate(undefined, {
      onSuccess: ({ run }) => dispatch({ type: 'started', run }),
      onError: (error) => {
        // 409: a sync is already running. Stay in `syncing`; the status poll picks it up.
        if (error instanceof ApiError && error.status === 409) {
          void status.refetch();
          return;
        }
        dispatch({
          type: 'start-failed',
          message: error instanceof ApiError ? error.message : 'Could not start the sync.',
        });
      },
    });
  }

  return {
    state,
    start,
    dismiss: () => dispatch({ type: 'dismiss' }),
    /** The latest run from the server; null when the store never synced, undefined while loading. */
    latestRun: latest?.run,
    isFirstRun: latest?.run === null,
    isReady: storeId !== undefined,
  };
}

export type SyncController = ReturnType<typeof useSync>;
