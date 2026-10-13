import { describe, expect, it } from 'vitest';
import { initialSyncState, type SyncEvent, type SyncState, syncReducer } from './sync-machine';
import type { SyncRun, SyncRunStatus } from './types';

const counts = { inserted: 0, updated: 0, unchanged: 0, failed: 0 };

function run(id: string, status: SyncRunStatus, overrides: Partial<SyncRun> = {}): SyncRun {
  return {
    id,
    storeId: 'store-1',
    status,
    startedAt: '2026-01-15T10:00:00.000Z',
    finishedAt: status === 'running' ? null : '2026-01-15T10:00:05.000Z',
    resumed: false,
    products: counts,
    orders: counts,
    error: null,
    ...overrides,
  };
}

const play = (events: SyncEvent[], from: SyncState = initialSyncState) =>
  events.reduce(syncReducer, from);

describe('syncReducer', () => {
  it('goes idle → syncing → success when the run it started finishes', () => {
    const state = play([
      { type: 'start-requested' },
      { type: 'started', run: run('a', 'running') },
      { type: 'run-observed', run: run('a', 'running') },
      { type: 'run-observed', run: run('a', 'succeeded') },
    ]);

    expect(state).toMatchObject({ status: 'success', partial: false });
  });

  it('reports a run that skipped records as a partial success', () => {
    const state = play([
      { type: 'start-requested' },
      { type: 'started', run: run('a', 'running') },
      { type: 'run-observed', run: run('a', 'partial') },
    ]);

    expect(state).toMatchObject({ status: 'success', partial: true });
  });

  it("goes to error with the run's message when it fails", () => {
    const failed = run('a', 'failed', { error: { message: 'Shopify is down' } });
    const state = play([
      { type: 'start-requested' },
      { type: 'started', run: run('a', 'running') },
      { type: 'run-observed', run: failed },
    ]);

    expect(state).toEqual({ status: 'error', message: 'Shopify is down', run: failed });
  });

  it('falls back to a generic message for a failed run without an error', () => {
    const state = play([
      { type: 'start-requested' },
      { type: 'started', run: run('a', 'running') },
      { type: 'run-observed', run: run('a', 'failed') },
    ]);

    expect(state.status).toBe('error');
    if (state.status === 'error') expect(state.message).toMatch(/failed/);
  });

  it('never mistakes the previous finished run for the outcome of the new one', () => {
    // The status cache still holds the last run (succeeded) while the POST is in flight.
    const state = play([
      { type: 'start-requested' },
      { type: 'run-observed', run: run('old', 'succeeded') },
    ]);
    expect(state).toEqual({ status: 'syncing', runId: null });

    const afterStart = play(
      [
        { type: 'started', run: run('new', 'running') },
        { type: 'run-observed', run: run('old', 'succeeded') },
      ],
      state,
    );
    expect(afterStart).toEqual({ status: 'syncing', runId: 'new' });
  });

  it('picks up a sync that is already running (page reload, other tab)', () => {
    const state = play([{ type: 'run-observed', run: run('x', 'running') }]);
    expect(state).toEqual({ status: 'syncing', runId: 'x' });
  });

  it('ignores a finished run it was not waiting for, and a store that never synced', () => {
    expect(play([{ type: 'run-observed', run: run('x', 'succeeded') }])).toEqual(initialSyncState);
    expect(play([{ type: 'run-observed', run: null }])).toEqual(initialSyncState);
  });

  it('goes to error when the request to start fails, and allows a retry', () => {
    const failed = play([
      { type: 'start-requested' },
      { type: 'start-failed', message: 'Unable to reach the server' },
    ]);
    expect(failed).toEqual({ status: 'error', message: 'Unable to reach the server', run: null });

    expect(play([{ type: 'start-requested' }], failed)).toEqual({ status: 'syncing', runId: null });
  });

  it('does not restart while already syncing', () => {
    const syncing = play([
      { type: 'start-requested' },
      { type: 'started', run: run('a', 'running') },
    ]);
    expect(play([{ type: 'start-requested' }], syncing)).toBe(syncing);
  });

  it('returns to idle on dismiss from success or error, but not while syncing', () => {
    const success = play([
      { type: 'start-requested' },
      { type: 'started', run: run('a', 'running') },
      { type: 'run-observed', run: run('a', 'succeeded') },
    ]);
    expect(play([{ type: 'dismiss' }], success)).toEqual(initialSyncState);

    const error = play([{ type: 'start-failed', message: 'x' }]);
    expect(play([{ type: 'dismiss' }], error)).toEqual(initialSyncState);

    const syncing = play([{ type: 'start-requested' }]);
    expect(play([{ type: 'dismiss' }], syncing)).toBe(syncing);
  });

  it('follows a newer running run after a finished one', () => {
    const success = play([
      { type: 'start-requested' },
      { type: 'started', run: run('a', 'running') },
      { type: 'run-observed', run: run('a', 'succeeded') },
    ]);
    expect(play([{ type: 'run-observed', run: run('b', 'running') }], success)).toEqual({
      status: 'syncing',
      runId: 'b',
    });
  });
});
