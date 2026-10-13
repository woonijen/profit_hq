import { lazy, Suspense } from 'react';
import { ErrorState, FirstRunState } from '@/components/dashboard/DashboardStates';
import { SummaryCards, SummaryCardsSkeleton } from '@/components/dashboard/SummaryCards';
import { TrendChartSkeleton } from '@/components/dashboard/TrendChartSkeleton';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { useDashboardParams } from '@/features/metrics/dashboard-params';
import { GRANULARITIES, RANGE_KEYS } from '@/features/metrics/types';
import { useSummary, useTrend } from '@/features/metrics/use-metrics';
import { useActiveStore } from '@/features/stores/use-active-store';
import { useSyncController } from '@/features/sync/sync-context';
import { ApiError } from '@/lib/api-client';

// Recharts is large; load it only when the chart is first shown.
const TrendChart = lazy(() =>
  import('@/components/dashboard/TrendChart').then((m) => ({ default: m.TrendChart })),
);

const RANGE_OPTIONS = RANGE_KEYS.map((value) => ({
  value,
  label: `${value.replace('d', '')} days`,
}));
const GRANULARITY_OPTIONS = GRANULARITIES.map((value) => ({
  value,
  label: value === 'day' ? 'Daily' : 'Monthly',
}));

const errorMessage = (error: unknown) =>
  error instanceof ApiError ? error.message : 'Something went wrong. Please try again.';

export function DashboardPage() {
  const { range, granularity, setRange, setGranularity } = useDashboardParams();
  const {
    store,
    isPending: storePending,
    error: storeError,
    refetch: refetchStore,
  } = useActiveStore();
  const sync = useSyncController();

  const syncing = sync.state.status === 'syncing';
  // Until the first sync there is nothing to query. `latestRun` is undefined while it loads.
  const hasSynced = sync.latestRun != null;
  const queryStoreId = hasSynced ? store?.id : undefined;
  const summary = useSummary(queryStoreId, range);
  const trend = useTrend(queryStoreId, range, granularity);

  if (storeError) {
    return (
      <ErrorState
        title="Could not load your store"
        message={errorMessage(storeError)}
        onRetry={() => void refetchStore()}
      />
    );
  }

  const header = (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        {store && <p className="mt-1 text-sm text-ink-muted">{store.shopDomain}</p>}
      </div>
      <SegmentedControl
        label="Date range"
        options={RANGE_OPTIONS}
        value={range}
        onChange={setRange}
      />
    </div>
  );

  // Waiting for the store or its sync status, or the very first sync is running.
  if (storePending || sync.latestRun === undefined) {
    return (
      <div className="space-y-6" role="status" aria-busy="true">
        <span className="sr-only">Loading dashboard</span>
        <SummaryCardsSkeleton />
        <TrendChartSkeleton />
      </div>
    );
  }

  if (!hasSynced) return <FirstRunState />;

  const loading = syncing || summary.isPending;
  const refreshing = summary.isPlaceholderData || trend.isPlaceholderData;

  return (
    <div className="space-y-6">
      {header}

      <section
        aria-label="Key metrics"
        aria-busy={loading}
        className={refreshing ? 'opacity-60' : ''}
      >
        {summary.error && !summary.data ? (
          <ErrorState
            title="Could not load metrics"
            message={errorMessage(summary.error)}
            onRetry={() => void summary.refetch()}
          />
        ) : loading || !summary.data ? (
          <SummaryCardsSkeleton />
        ) : (
          <SummaryCards summary={summary.data} />
        )}
      </section>

      <section
        aria-labelledby="trend-title"
        aria-busy={syncing || trend.isPending}
        className="rounded-lg border border-line bg-card p-5 shadow-sm"
      >
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 id="trend-title" className="text-base font-semibold">
            Net revenue and net margin
          </h2>
          <SegmentedControl
            label="Chart granularity"
            options={GRANULARITY_OPTIONS}
            value={granularity}
            onChange={setGranularity}
          />
        </div>
        <div className={refreshing ? 'opacity-60' : ''}>
          {trend.error && !trend.data ? (
            <ErrorState
              title="Could not load the trend"
              message={errorMessage(trend.error)}
              onRetry={() => void trend.refetch()}
            />
          ) : syncing || !trend.data ? (
            <TrendChartSkeleton />
          ) : (
            <Suspense fallback={<TrendChartSkeleton />}>
              <TrendChart trend={trend.data} />
            </Suspense>
          )}
        </div>
      </section>
    </div>
  );
}
