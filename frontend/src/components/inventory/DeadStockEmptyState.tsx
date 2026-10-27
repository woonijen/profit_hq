import type { DeadStockWindow } from '@/features/inventory/types';

/** Shown when nothing in stock has gone unsold for the whole window: good news, not an error. */
export function DeadStockEmptyState({ window }: { window: DeadStockWindow }) {
  return (
    <div className="rounded-lg border border-dashed border-line-strong bg-card px-6 py-10 text-center">
      <p className="text-lg font-semibold">No dead stock, nice</p>
      <p className="mt-1 text-ink-muted">
        Everything in stock sold at least once in the last {window} days.
      </p>
    </div>
  );
}
