import { SEGMENT_LABELS } from '@/features/retention/segments';
import type { CustomerSegment } from '@/features/retention/types';

const boxClass =
  'rounded-lg border border-dashed border-line-strong bg-card px-6 py-10 text-center';

/** Shown when no synced order belongs to a customer, so there is nobody to segment yet. */
export function NoCustomersYet({ guestOrders }: { guestOrders: number }) {
  return (
    <div className={boxClass}>
      <p className="text-lg font-semibold">No customers yet</p>
      <p className="mt-1 text-ink-muted">
        Customers appear here once synced orders are linked to a customer.
        {guestOrders > 0 &&
          ` ${guestOrders} ${guestOrders === 1 ? 'order was' : 'orders were'} placed as a guest checkout, which cannot be tracked to a customer.`}
      </p>
    </div>
  );
}

/** Shown when a segment filter matches nobody. The cards above still show every segment. */
export function NoCustomersInSegment({ segment }: { segment: CustomerSegment }) {
  return (
    <div className={boxClass}>
      <p className="text-lg font-semibold">No {SEGMENT_LABELS[segment]} customers right now</p>
      <p className="mt-1 text-ink-muted">Select the segment again to show everyone.</p>
    </div>
  );
}
