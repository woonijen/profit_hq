import { SyncButton } from '@/features/sync/SyncButton';

/** Shown until the store has been synced once: there is nothing to chart yet. */
export function FirstRunState() {
  return (
    <section
      aria-labelledby="first-run-title"
      className="mx-auto max-w-xl rounded-lg border border-dashed border-line-strong bg-card px-6 py-12 text-center"
    >
      <h2 id="first-run-title" className="text-lg font-semibold">
        Run your first sync
      </h2>
      <p className="mt-2 text-ink-muted">
        ProfitHQ works out your true net profit from your orders and what your products cost. Sync
        your store to load them; it takes a few seconds.
      </p>
      <div className="mt-6 flex justify-center">
        <SyncButton />
      </div>
    </section>
  );
}

export function ErrorState({
  title,
  message,
  onRetry,
}: {
  title: string;
  message: string;
  onRetry: () => void;
}) {
  return (
    <div role="alert" className="rounded-lg border border-danger bg-danger-bg px-5 py-4">
      <p className="font-medium text-danger">{title}</p>
      <p className="mt-1 text-sm text-danger">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-3 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-fg hover:bg-primary-hover"
      >
        Try again
      </button>
    </div>
  );
}
