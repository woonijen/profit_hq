import { useEffect } from 'react';
import { ErrorState, FirstRunState } from '@/components/dashboard/DashboardStates';
import { DeadStockTable, DeadStockTableSkeleton } from '@/components/inventory/DeadStockTable';
import { Pagination } from '@/components/inventory/Pagination';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { useDeadStockParams } from '@/features/inventory/dead-stock-params';
import { DEAD_STOCK_WINDOWS, type DeadStockWindow } from '@/features/inventory/types';
import { useDeadStock } from '@/features/inventory/use-dead-stock';
import { formatInteger, formatMoney } from '@/features/metrics/format';
import { useActiveStore } from '@/features/stores/use-active-store';
import { useSyncController } from '@/features/sync/sync-context';
import { ApiError } from '@/lib/api-client';

const WINDOW_OPTIONS = DEAD_STOCK_WINDOWS.map((value) => ({
  value: String(value),
  label: `${value} days`,
}));

const errorMessage = (error: unknown) =>
  error instanceof ApiError ? error.message : 'Something went wrong. Please try again.';

export function DeadStockPage() {
  const { query, setWindow, setSort, setPage } = useDeadStockParams();
  const { store, isPending: storePending, error: storeError, refetch } = useActiveStore();
  const sync = useSyncController();

  const syncing = sync.state.status === 'syncing';
  // Until the first sync there is no inventory to look at. `latestRun` is undefined while loading.
  const hasSynced = sync.latestRun != null;
  const report = useDeadStock(hasSynced ? store?.id : undefined, query);

  // A shared link can point past the last page (e.g. after stock sold): go to the last one.
  const totalPages = report.data?.page.totalPages;
  useEffect(() => {
    if (totalPages !== undefined && query.page > Math.max(1, totalPages)) {
      setPage(Math.max(1, totalPages));
    }
  }, [totalPages, query.page, setPage]);

  if (storeError) {
    return (
      <ErrorState
        title="Could not load your store"
        message={errorMessage(storeError)}
        onRetry={() => void refetch()}
      />
    );
  }

  const header = (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dead stock</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Products in stock that have not sold in the last {query.window} days.
        </p>
      </div>
      <SegmentedControl
        label="Days without a sale"
        options={WINDOW_OPTIONS}
        value={String(query.window)}
        onChange={(value) => setWindow(Number(value) as DeadStockWindow)}
      />
    </div>
  );

  if (storePending || sync.latestRun === undefined) {
    return (
      <div className="space-y-6" role="status" aria-busy="true">
        <span className="sr-only">Loading dead stock</span>
        <DeadStockTableSkeleton />
      </div>
    );
  }

  if (!hasSynced) return <FirstRunState />;

  const data = report.data;
  const refreshing = report.isPlaceholderData;

  let content;
  if (report.error && !data) {
    content = (
      <ErrorState
        title="Could not load dead stock"
        message={errorMessage(report.error)}
        onRetry={() => void report.refetch()}
      />
    );
  } else if (syncing || !data) {
    content = <DeadStockTableSkeleton />;
  } else if (data.totals.variants === 0) {
    content = (
      <p className="rounded-lg border border-dashed border-line-strong bg-card px-6 py-10 text-center text-ink-muted">
        No dead stock: everything in stock sold in the last {data.window} days.
      </p>
    );
  } else {
    const currency = store?.currency ?? 'USD';
    const { totals } = data;
    content = (
      <>
        <p className="text-sm text-ink-muted">
          <span className="font-medium text-ink">{formatInteger(totals.variants)}</span> variants,{' '}
          <span className="font-medium text-ink">{formatInteger(totals.units)}</span> units,{' '}
          <span className="font-medium text-ink">
            {formatMoney(totals.stockValueCents, currency)}
          </span>{' '}
          tied up
          {totals.variantsMissingCost > 0 &&
            ` (${formatInteger(totals.variantsMissingCost)} without a cost are not counted)`}
          .
        </p>
        <DeadStockTable
          items={data.items}
          currency={currency}
          sort={query.sort}
          direction={query.direction}
          onSort={setSort}
        />
        <Pagination page={query.page} totalPages={data.page.totalPages} onChange={setPage} />
      </>
    );
  }

  return (
    <div className="space-y-6">
      {header}
      <section
        aria-label="Dead stock"
        aria-busy={syncing || report.isPending}
        className={`space-y-4 ${refreshing ? 'opacity-60' : ''}`}
      >
        {content}
      </section>
    </div>
  );
}
