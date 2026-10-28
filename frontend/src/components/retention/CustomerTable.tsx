import { SegmentBadge } from '@/components/retention/SegmentBadge';
import { Skeleton } from '@/components/ui/Skeleton';
import { SortableHeader } from '@/components/ui/SortableHeader';
import {
  CORNER_HEAD_CELL,
  HEAD_CELL,
  PINNED_CELL,
  TABLE_SCROLL_BOX,
} from '@/components/ui/table-styles';
import { formatInteger, formatMoney } from '@/features/metrics/format';
import { formatDaysAgo, formatOrderDate } from '@/features/retention/format';
import type { CustomerRow, CustomerSort, SortDirection } from '@/features/retention/types';

interface CustomerTableProps {
  items: readonly CustomerRow[];
  currency: string;
  sort: CustomerSort;
  direction: SortDirection;
  onSort: (column: CustomerSort) => void;
}

export function CustomerTable({ items, currency, sort, direction, onSort }: CustomerTableProps) {
  const header = { activeSort: sort, direction, onSort, cellClassName: HEAD_CELL };
  return (
    // Focusable so keyboard users can scroll the table sideways on a narrow screen.
    <div role="region" aria-label="Customers table" tabIndex={0} className={TABLE_SCROLL_BOX}>
      <table className="w-full min-w-[48rem] text-sm">
        <caption className="sr-only">Customers with their segment</caption>
        <thead className="text-ink-muted">
          <tr>
            <th scope="col" className={`${CORNER_HEAD_CELL} px-4 py-3 text-left font-medium`}>
              Customer
            </th>
            <th scope="col" className={`${HEAD_CELL} px-4 py-3 text-left font-medium`}>
              Segment
            </th>
            <SortableHeader label="Lifetime spend" column="lifetimeSpend" {...header} />
            <SortableHeader label="Orders" column="orders" {...header} />
            <SortableHeader label="Last order" column="lastOrder" {...header} />
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {items.map((customer) => (
            <tr key={customer.customerId}>
              <th scope="row" className={`${PINNED_CELL} px-4 py-3 text-left font-normal`}>
                <span className="font-medium">{customer.name ?? customer.identifier}</span>
                {customer.name && (
                  <span className="block text-ink-muted">{customer.identifier}</span>
                )}
              </th>
              <td className="px-4 py-3 text-left">
                <SegmentBadge segment={customer.segment} />
              </td>
              <td className="px-4 py-3 text-right whitespace-nowrap tabular-nums">
                {formatMoney(customer.lifetimeSpendCents, currency)}
              </td>
              <td className="px-4 py-3 text-right tabular-nums">
                {formatInteger(customer.orders)}
              </td>
              <td className="px-4 py-3 text-right whitespace-nowrap tabular-nums">
                {formatOrderDate(customer.lastOrderAt)}
                <span className="block text-ink-muted">
                  {formatDaysAgo(customer.daysSinceLastOrder)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function CustomerTableSkeleton() {
  return (
    <div className="space-y-3 rounded-lg border border-line bg-card p-4 shadow-sm">
      {Array.from({ length: 6 }, (_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}
