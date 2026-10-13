import { useSyncController } from './sync-context';

export function SyncButton() {
  const { state, start, isReady } = useSyncController();
  const syncing = state.status === 'syncing';
  const label = syncing ? 'Syncing…' : state.status === 'error' ? 'Retry sync' : 'Sync now';

  return (
    <button
      type="button"
      onClick={start}
      disabled={!isReady || syncing}
      className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-fg hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
    >
      {syncing && (
        <span
          aria-hidden="true"
          className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      )}
      {label}
    </button>
  );
}
