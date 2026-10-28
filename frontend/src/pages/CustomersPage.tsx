import { useEffect } from 'react';
import { ErrorState, FirstRunState } from '@/components/dashboard/DashboardStates';
import { Pagination } from '@/components/inventory/Pagination';
import { CustomerTable, CustomerTableSkeleton } from '@/components/retention/CustomerTable';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { useCustomerParams } from '@/features/retention/customer-params';
import { SEGMENT_LABELS } from '@/features/retention/segments';
import { CUSTOMER_SEGMENTS, type CustomerSegment } from '@/features/retention/types';
import { useCustomerSegments } from '@/features/retention/use-customer-segments';
import { useActiveStore } from '@/features/stores/use-active-store';
import { useSyncController } from '@/features/sync/sync-context';
import { ApiError } from '@/lib/api-client';

type SegmentFilter = CustomerSegment | 'ALL';

const FILTER_OPTIONS: { value: SegmentFilter; label: string }[] = [
  { value: 'ALL', label: 'All' },
  ...CUSTOMER_SEGMENTS.map((value) => ({ value, label: SEGMENT_LABELS[value] })),
];

const errorMessage = (error: unknown) =>
  error instanceof ApiError ? error.message : 'Something went wrong. Please try again.';

export function CustomersPage() {
  const { query, setSegment, setSort, setPage } = useCustomerParams();
  const { store, isPending: storePending, error: storeError, refetch } = useActiveStore();
  const sync = useSyncController();

  const syncing = sync.state.status === 'syncing';
  // Until the first sync there are no orders to look at. `latestRun` is undefined while loading.
  const hasSynced = sync.latestRun != null;
  const report = useCustomerSegments(hasSynced ? store?.id : undefined, query);

  // A shared link can point past the last page: go to the last one.
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
        <h1 className="text-2xl font-semibold tracking-tight">Customers</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Who is buying, who is slipping away and who is gone, by how recently and how often they
          ordered.
        </p>
      </div>
      <SegmentedControl
        label="Segment"
        options={FILTER_OPTIONS}
        value={query.segment ?? 'ALL'}
        onChange={(value) => setSegment(value === 'ALL' ? undefined : value)}
      />
    </div>
  );

  if (storePending || sync.latestRun === undefined) {
    return (
      <div className="space-y-6">
        {header}
        <div role="status" aria-busy="true">
          <span className="sr-only">Loading customers</span>
          <CustomerTableSkeleton />
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
        title="Could not load customers"
        message={errorMessage(report.error)}
        onRetry={() => void report.refetch()}
      />
    );
  } else if (syncing || !data) {
    content = <CustomerTableSkeleton />;
  } else if (data.page.totalItems === 0) {
    content = (
      <p className="rounded-lg border border-dashed border-line-strong bg-card px-6 py-10 text-center text-ink-muted">
        No customers to show.
      </p>
    );
  } else {
    content = (
      <>
        <CustomerTable
          items={data.items}
          currency={store?.currency ?? 'USD'}
          sort={query.sort}
          direction={query.direction}
          onSort={setSort}
        />
        <Pagination page={query.page} totalPages={data.page.totalPages} onChange={setPage} />
        {data.summary.guestOrders > 0 && (
          <p className="text-sm text-ink-muted">
            {data.summary.guestOrders} orders from guest checkouts are not included.
          </p>
        )}
      </>
    );
  }

  return (
    <div className="flex min-h-96 flex-1 flex-col gap-6">
      {header}
      <section
        aria-label="Customers"
        aria-busy={syncing || report.isPending}
        className={`flex min-h-0 flex-1 flex-col gap-4 ${refreshing ? 'opacity-60' : ''}`}
      >
        {content}
      </section>
    </div>
  );
}
