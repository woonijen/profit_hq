import { formatMoney } from '@/features/metrics/format';
import type { DeadStockItem } from '@/features/inventory/types';

interface MarkdownCellProps {
  item: DeadStockItem;
  currency: string;
}

/**
 * The suggested discount with the price it leads to. A price under the unit cost gets a warning
 * made of an icon and words (not only a color) that also says how much each sale would lose.
 */
export function MarkdownCell({ item, currency }: MarkdownCellProps) {
  const { suggestedDiscountPct, suggestedPriceCents, priceCents, marginAfterMarkdownCents } = item;
  if (suggestedDiscountPct === 0) return <span className="text-ink-muted">None</span>;

  return (
    <div className="flex flex-col items-end gap-0.5">
      <span className="flex items-center gap-2">
        <span className="rounded-full bg-hover px-2 py-0.5 text-xs font-semibold tabular-nums">
          <span className="sr-only">Discount </span>−{suggestedDiscountPct}%
        </span>
        <span className="font-medium tabular-nums">
          {formatMoney(suggestedPriceCents, currency)}
        </span>
      </span>
      <span className="text-xs text-ink-muted tabular-nums">
        <span className="sr-only">Current price </span>
        <span className="line-through">{formatMoney(priceCents, currency)}</span>
      </span>
      {item.belowCost && marginAfterMarkdownCents !== null && (
        <span className="rounded border border-bad px-1.5 py-0.5 text-xs font-semibold text-bad">
          <span aria-hidden="true">⚠ </span>
          Below cost: loses {formatMoney(-marginAfterMarkdownCents, currency)} per unit
        </span>
      )}
    </div>
  );
}
