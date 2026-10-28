import { SegmentBadge } from '@/components/retention/SegmentBadge';
import { Skeleton } from '@/components/ui/Skeleton';
import { formatInteger, formatMoney, formatPercent } from '@/features/metrics/format';
import {
  CUSTOMER_SEGMENTS,
  type CustomerSegment,
  type SegmentSummary,
} from '@/features/retention/types';

interface SegmentCardsProps {
  segments: Record<CustomerSegment, SegmentSummary>;
  currency: string;
  /** The segment the table is filtered to; undefined when it lists everyone. */
  selected: CustomerSegment | undefined;
  /** Called with undefined when the selected card is pressed again, to show everyone. */
  onSelect: (segment: CustomerSegment | undefined) => void;
}

/**
 * One card per segment with its size and value. The cards are also the filter: a card is a toggle
 * button (`aria-pressed`) and pressing the selected one again clears the filter. The figures cover
 * every customer, whatever the filter.
 */
export function SegmentCards({ segments, currency, selected, onSelect }: SegmentCardsProps) {
  return (
    <div
      role="group"
      aria-label="Filter by segment"
      className="grid grid-cols-2 gap-3 lg:grid-cols-4"
    >
      {CUSTOMER_SEGMENTS.map((segment) => {
        const { customers, shareOfRevenue, averageSpendCents } = segments[segment];
        const pressed = segment === selected;
        return (
          <button
            key={segment}
            type="button"
            aria-pressed={pressed}
            onClick={() => onSelect(pressed ? undefined : segment)}
            className={`flex flex-col items-start gap-1 rounded-lg border bg-card p-4 text-left shadow-sm hover:bg-hover ${
              pressed ? 'border-accent ring-2 ring-accent' : 'border-line'
            }`}
          >
            <SegmentBadge segment={segment} className="mb-1" />
            <span className="text-2xl font-semibold tracking-tight tabular-nums">
              {formatInteger(customers)}{' '}
              <span className="text-sm font-normal text-ink-muted">
                {customers === 1 ? 'customer' : 'customers'}
              </span>
            </span>
            {customers === 0 ? (
              <span className="text-sm text-ink-muted">No spend yet</span>
            ) : (
              <>
                <span className="text-sm text-ink-muted">
                  {shareOfRevenue === null
                    ? 'No revenue'
                    : `${formatPercent(shareOfRevenue)} of revenue`}
                </span>
                <span className="text-sm text-ink-muted">
                  {formatMoney(averageSpendCents, currency)} average spend
                </span>
              </>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function SegmentCardsSkeleton() {
  return (
    <div aria-hidden="true" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {CUSTOMER_SEGMENTS.map((segment) => (
        <div key={segment} className="rounded-lg border border-line bg-card p-4 shadow-sm">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="mt-3 h-8 w-24" />
          <Skeleton className="mt-3 h-4 w-32" />
        </div>
      ))}
    </div>
  );
}
