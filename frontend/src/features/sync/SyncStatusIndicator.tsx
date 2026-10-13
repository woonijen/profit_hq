import { formatInteger } from '@/features/metrics/format';
import { useSyncController } from './sync-context';
import type { SyncRun } from './types';

const timeFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
});

function describeIdle(run: SyncRun | null | undefined): string {
  if (run === undefined) return '';
  if (run === null) return 'Not synced yet';
  return run.finishedAt ? `Last synced ${timeFormatter.format(new Date(run.finishedAt))}` : '';
}

/**
 * Says what the sync is doing. The live region is always in the page and only its text changes,
 * which is what makes screen readers announce the changes ("Syncing…", "Sync complete").
 */
export function SyncStatusIndicator() {
  const { state, latestRun } = useSyncController();

  let text: string;
  let tone = 'text-ink-muted';
  switch (state.status) {
    case 'idle':
      text = describeIdle(latestRun);
      break;
    case 'syncing':
      text = 'Syncing your store data…';
      break;
    case 'success': {
      const orders = state.run.orders.inserted + state.run.orders.updated;
      text = state.partial
        ? `Synced, but ${formatInteger(state.run.orders.failed + state.run.products.failed)} records were skipped`
        : `Sync complete · ${formatInteger(orders)} ${orders === 1 ? 'order' : 'orders'} changed`;
      tone = state.partial ? 'text-bad' : 'text-good';
      break;
    }
    case 'error':
      text = `Sync failed: ${state.message}`;
      tone = 'text-bad';
      break;
  }

  return (
    <p role="status" aria-live="polite" className={`min-w-0 truncate text-sm ${tone}`} title={text}>
      {text}
    </p>
  );
}
