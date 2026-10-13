import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SyncButton } from './SyncButton';
import { SyncContext } from './sync-context';
import type { SyncState } from './sync-machine';
import { SyncStatusIndicator } from './SyncStatusIndicator';
import type { SyncController } from './use-sync';
import type { SyncRun } from './types';

const counts = { inserted: 0, updated: 0, unchanged: 0, failed: 0 };
const finishedRun: SyncRun = {
  id: 'r1',
  storeId: 's1',
  status: 'succeeded',
  startedAt: '2026-01-15T10:00:00.000Z',
  finishedAt: '2026-01-15T10:00:05.000Z',
  resumed: false,
  products: counts,
  orders: { ...counts, inserted: 1000, updated: 51 },
  error: null,
};

function renderWith(state: SyncState, overrides: Partial<SyncController> = {}) {
  const controller: SyncController = {
    state,
    start: vi.fn(),
    dismiss: vi.fn(),
    latestRun: finishedRun,
    isFirstRun: false,
    isReady: true,
    ...overrides,
  };
  render(
    <SyncContext value={controller}>
      <SyncButton />
      <SyncStatusIndicator />
    </SyncContext>,
  );
  return controller;
}

describe('SyncButton', () => {
  it('starts a sync when clicked', async () => {
    const controller = renderWith({ status: 'idle' });

    await userEvent.click(screen.getByRole('button', { name: 'Sync now' }));

    expect(controller.start).toHaveBeenCalledOnce();
  });

  it('is disabled and says so while syncing', () => {
    renderWith({ status: 'syncing', runId: 'r1' });

    expect(screen.getByRole('button', { name: 'Syncing…' })).toBeDisabled();
  });

  it('is disabled until the store is known', () => {
    renderWith({ status: 'idle' }, { isReady: false });

    expect(screen.getByRole('button', { name: 'Sync now' })).toBeDisabled();
  });

  it('offers a retry after a failure', async () => {
    const controller = renderWith({ status: 'error', message: 'boom', run: null });

    await userEvent.click(screen.getByRole('button', { name: 'Retry sync' }));

    expect(controller.start).toHaveBeenCalledOnce();
  });
});

describe('SyncStatusIndicator', () => {
  it('is a polite live region, so screen readers announce each change', () => {
    renderWith({ status: 'idle' });

    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
  });

  it.each([
    ['syncing', { status: 'syncing', runId: 'r1' } as const, /Syncing your store data/],
    [
      'success',
      { status: 'success', run: finishedRun, partial: false } as const,
      /Sync complete · 1,051 orders changed/,
    ],
    [
      'partial success',
      {
        status: 'success',
        run: { ...finishedRun, orders: { ...counts, failed: 3 } },
        partial: true,
      } as const,
      /3 records were skipped/,
    ],
    [
      'error',
      { status: 'error', message: 'Shopify is down', run: null } as const,
      /Sync failed: Shopify is down/,
    ],
    ['idle', { status: 'idle' } as const, /Last synced/],
  ])('describes the %s state', (_name, state, text) => {
    renderWith(state);

    expect(screen.getByRole('status')).toHaveTextContent(text);
  });

  it('says when the store has never been synced', () => {
    renderWith({ status: 'idle' }, { latestRun: null, isFirstRun: true });

    expect(screen.getByRole('status')).toHaveTextContent('Not synced yet');
  });
});
