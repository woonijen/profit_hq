import { Skeleton } from '@/components/ui/Skeleton';
import { formatInteger, formatMoney } from '@/features/metrics/format';
import { formatDays, formatLastSold } from '@/features/inventory/format';
import type { DeadStockItem, DeadStockSort, SortDirection } from '@/features/inventory/types';

interface SortableHeaderProps {
  label: string;
  column: DeadStockSort;
  activeSort: DeadStockSort;
  direction: SortDirection;
  onSort: (column: DeadStockSort) => void;
}

/** A column header that sorts the table. `aria-sort` tells screen readers which one is active. */
function SortableHeader({ label, column, activeSort, direction, onSort }: SortableHeaderProps) {
  const active = column === activeSort;
  return (
    <th
      scope="col"
      aria-sort={active ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'}
      className="px-4 py-3 text-right font-medium"
    >
      <button
        type="button"
        onClick={() => onSort(column)}
        className="inline-flex items-center gap-1 rounded hover:text-ink"
      >
        {label}
        <span aria-hidden="true" className="text-xs">
          {active ? (direction === 'asc' ? '▲' : '▼') : ''}
        </span>
      </button>
    </th>
  );
}

interface DeadStockTableProps {
  items: readonly DeadStockItem[];
  currency: string;
  sort: DeadStockSort;
  direction: SortDirection;
  onSort: (column: DeadStockSort) => void;
}

export function DeadStockTable({ items, currency, sort, direction, onSort }: DeadStockTableProps) {
  const header = { activeSort: sort, direction, onSort };
  return (
    <div className="overflow-x-auto rounded-lg border border-line bg-card shadow-sm">
      <table className="w-full min-w-[40rem] text-sm">
        <caption className="sr-only">Products in stock that have not sold</caption>
        <thead className="border-b border-line text-ink-muted">
          <tr>
            <th scope="col" className="px-4 py-3 text-left font-medium">
              Product
            </th>
            <SortableHeader label="In stock" column="quantity" {...header} />
            <SortableHeader label="Stock value" column="stockValue" {...header} />
            <th scope="col" className="px-4 py-3 text-right font-medium">
              Last sold
            </th>
            <SortableHeader label="Days inactive" column="daysInactive" {...header} />
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {items.map((item) => (
            <tr key={item.variantId}>
              <th scope="row" className="px-4 py-3 text-left font-normal">
                <span className="font-medium">{item.productTitle}</span>
                <span className="block text-ink-muted">
                  {[item.variantTitle === 'Default Title' ? null : item.variantTitle, item.sku]
                    .filter(Boolean)
                    .join(' · ') || ' '}
                </span>
              </th>
              <td className="px-4 py-3 text-right tabular-nums">
                {formatInteger(item.inventoryQuantity)}
              </td>
              <td className="px-4 py-3 text-right tabular-nums">
                {item.stockValueCents === null ? (
                  <span className="text-ink-muted">Cost missing</span>
                ) : (
                  formatMoney(item.stockValueCents, currency)
                )}
              </td>
              <td className="px-4 py-3 text-right text-ink-muted tabular-nums">
                {formatLastSold(item.lastSoldAt)}
              </td>
              <td className="px-4 py-3 text-right font-medium tabular-nums">
                {formatDays(item.daysInactive)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function DeadStockTableSkeleton() {
  return (
    <div className="space-y-3 rounded-lg border border-line bg-card p-4 shadow-sm">
      {Array.from({ length: 6 }, (_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}
