import { Skeleton } from '@/components/ui/Skeleton';
import { SortableHeader } from '@/components/ui/SortableHeader';
import { MarkdownCell } from './MarkdownCell';
import { formatInteger, formatMoney } from '@/features/metrics/format';
import { formatDays, formatLastSold } from '@/features/inventory/format';
import type { DeadStockItem, DeadStockSort, SortDirection } from '@/features/inventory/types';

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
    // Focusable so keyboard users can scroll the table sideways on a narrow screen.
    <div
      role="region"
      aria-label="Dead stock table"
      tabIndex={0}
      className="overflow-x-auto rounded-lg border border-line bg-card shadow-sm"
    >
      <table className="w-full min-w-[60rem] text-sm">
        <caption className="sr-only">Products in stock that have not sold</caption>
        <thead className="border-b border-line text-ink-muted">
          <tr>
            <th scope="col" className="sticky left-0 bg-card px-4 py-3 text-left font-medium">
              Product
            </th>
            <SortableHeader label="In stock" column="quantity" {...header} />
            <SortableHeader label="Stock value" column="stockValue" {...header} />
            <th scope="col" className="px-4 py-3 text-right font-medium">
              Holding cost / month
            </th>
            <th scope="col" className="px-4 py-3 text-right font-medium">
              Suggested markdown
            </th>
            <th scope="col" className="px-4 py-3 text-right font-medium">
              Last sold
            </th>
            <SortableHeader label="Days inactive" column="daysInactive" {...header} />
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {items.map((item) => (
            <tr key={item.variantId}>
              <th scope="row" className="sticky left-0 bg-card px-4 py-3 text-left font-normal">
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
              <td className="px-4 py-3 text-right whitespace-nowrap tabular-nums">
                {item.stockValueCents === null ? (
                  <span className="text-ink-muted">Cost missing</span>
                ) : (
                  formatMoney(item.stockValueCents, currency)
                )}
              </td>
              <td className="px-4 py-3 text-right whitespace-nowrap tabular-nums">
                {item.holdingCostCents === null ? (
                  <span className="text-ink-muted">Cost missing</span>
                ) : (
                  formatMoney(item.holdingCostCents, currency)
                )}
              </td>
              <td className="px-4 py-3 text-right">
                <MarkdownCell item={item} currency={currency} />
              </td>
              <td className="px-4 py-3 text-right whitespace-nowrap text-ink-muted tabular-nums">
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
