import { useEffect } from 'react';
import { ErrorState, FirstRunState } from '@/components/dashboard/DashboardStates';
import {
  DeadStockSummary,
  DeadStockSummarySkeleton,
} from '@/components/inventory/DeadStockSummary';
import { DeadStockEmptyState } from '@/components/inventory/DeadStockEmptyState';
import { DeadStockTable, DeadStockTableSkeleton } from '@/components/inventory/DeadStockTable';
import { HoldingCostRateForm } from '@/components/inventory/HoldingCostRateForm';
import { Pagination } from '@/components/inventory/Pagination';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { useDeadStockParams } from '@/features/inventory/dead-stock-params';
import { DEAD_STOCK_WINDOWS, type DeadStockWindow } from '@/features/inventory/types';
import { useDeadStock } from '@/features/inventory/use-dead-stock';
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
      <div className="space-y-6">
        {header}
        <div className="space-y-6" role="status" aria-busy="true">
          <span className="sr-only">Loading dead stock</span>
          <DeadStockSummarySkeleton />
          <DeadStockTableSkeleton />
        </div>
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
    content = (
      <>
        <DeadStockSummarySkeleton />
        <DeadStockTableSkeleton />
      </>
    );
  } else if (data.totals.variants === 0) {
    content = <DeadStockEmptyState window={data.window} />;
  } else {
    const currency = store?.currency ?? 'USD';
    content = (
      <>
        <DeadStockSummary totals={data.totals} currency={currency} />
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
      {store && <HoldingCostRateForm storeId={store.id} rate={store.settings.holdingCostRate} />}
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
