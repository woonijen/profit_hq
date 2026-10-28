import { formatDays } from '@/features/inventory/format';

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
});

/** ISO date-time → "Jan 2, 2026". */
export const formatOrderDate = (iso: string): string => dateFormatter.format(new Date(iso));

/** 0 → "Today", 1 → "1 day ago", 45 → "45 days ago". */
export function formatDaysAgo(days: number): string {
  return days === 0 ? 'Today' : `${formatDays(days)} ago`;
}
