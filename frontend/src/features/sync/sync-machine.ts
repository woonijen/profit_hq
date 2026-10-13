import type { SyncRun } from './types';

/**
 * The sync button's state machine: idle → syncing → success | error → idle.
 *
 * It is driven by what the server reports about runs, not by the click alone, so a page reload
 * or a second tab during a running sync lands in `syncing` as well. `syncing` remembers which
 * run it waits for (`runId`, null until the POST answers), so the last finished run in the
 * cache can never be mistaken for the outcome of the one just started.
 */
export type SyncState =
  | { status: 'idle' }
  | { status: 'syncing'; runId: string | null }
  | { status: 'success'; run: SyncRun; partial: boolean }
  | { status: 'error'; message: string; run: SyncRun | null };

export type SyncEvent =
  /** The user asked for a sync; the request is in flight. */
  | { type: 'start-requested' }
  /** The server accepted it and created this run. */
  | { type: 'started'; run: SyncRun }
  /** The request itself failed (not the sync). */
  | { type: 'start-failed'; message: string }
  /** The latest run as last reported by the server (null: never synced). */
  | { type: 'run-observed'; run: SyncRun | null }
  /** Leave `success` or `error` (auto-reset, or the user closed the message). */
  | { type: 'dismiss' };

export const initialSyncState: SyncState = { status: 'idle' };

const FALLBACK_ERROR = 'The sync failed. Please try again.';

export function syncReducer(state: SyncState, event: SyncEvent): SyncState {
  switch (event.type) {
    case 'start-requested':
      return state.status === 'syncing' ? state : { status: 'syncing', runId: null };

    case 'started':
      return { status: 'syncing', runId: event.run.id };

    case 'start-failed':
      return { status: 'error', message: event.message, run: null };

    case 'dismiss':
      return state.status === 'success' || state.status === 'error' ? initialSyncState : state;

    case 'run-observed': {
      const { run } = event;
      if (!run) return state;

      if (run.status === 'running') {
        // A run we did not start (another tab, before a reload) or one whose id we now learn.
        return state.status === 'syncing' && state.runId === run.id
          ? state
          : { status: 'syncing', runId: run.id };
      }

      // A finished run only matters if it is the one we are waiting for.
      if (state.status !== 'syncing' || state.runId !== run.id) return state;
      if (run.status === 'failed') {
        return { status: 'error', message: run.error?.message ?? FALLBACK_ERROR, run };
      }
      return { status: 'success', run, partial: run.status === 'partial' };
    }
  }
}
