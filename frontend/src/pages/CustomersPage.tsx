import { useEffect } from 'react';
import { ErrorState, FirstRunState } from '@/components/dashboard/DashboardStates';
import { Pagination } from '@/components/inventory/Pagination';
import { NoCustomersInSegment, NoCustomersYet } from '@/components/retention/CustomersEmptyState';
import { CustomerTable, CustomerTableSkeleton } from '@/components/retention/CustomerTable';
import { SegmentCards, SegmentCardsSkeleton } from '@/components/retention/SegmentCards';
import { useCustomerParams } from '@/features/retention/customer-params';
import { SEGMENT_LABELS } from '@/features/retention/segments';
import { useCustomerSegments } from '@/features/retention/use-customer-segments';
import { useActiveStore } from '@/features/stores/use-active-store';
import { useSyncController } from '@/features/sync/sync-context';
import { ApiError } from '@/lib/api-client';

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
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Customers</h1>
      <p className="mt-1 text-sm text-ink-muted">
        Who is buying, who is slipping away and who is gone, by how recently and how often they
        ordered. Select a segment to filter the list.
      </p>
    </div>
  );

  if (storePending || sync.latestRun === undefined) {
    return (
      <div className="space-y-6">
        {header}
        <div role="status" aria-busy="true" className="space-y-6">
          <span className="sr-only">Loading customers</span>
          <SegmentCardsSkeleton />
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
  } else if (data.summary.customers === 0) {
    content = <NoCustomersYet guestOrders={data.summary.guestOrders} />;
  } else if (data.page.totalItems === 0 && query.segment) {
    content = <NoCustomersInSegment segment={query.segment} />;
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
      {data
        ? data.summary.customers > 0 && (
            <SegmentCards
              segments={data.summary.segments}
              currency={store?.currency ?? 'USD'}
              selected={query.segment}
              onSelect={setSegment}
            />
          )
        : !report.error && <SegmentCardsSkeleton />}
      <section
        aria-label="Customers"
        aria-busy={syncing || report.isPending}
        className={`flex min-h-0 flex-1 flex-col gap-4 ${refreshing ? 'opacity-60' : ''}`}
      >
        {data && (
          <p aria-live="polite" className="sr-only">
            {data.page.totalItems} {query.segment ? `${SEGMENT_LABELS[query.segment]} ` : ''}
            {data.page.totalItems === 1 ? 'customer' : 'customers'}
          </p>
        )}
        {content}
      </section>
    </div>
  );
}
