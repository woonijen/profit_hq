const dateFormatter = new Intl.DateTimeFormat(undefined, {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
});

/** ISO date-time → "Jan 2, 2026"; "Never" when the variant never sold. */
export function formatLastSold(iso: string | null): string {
  return iso === null ? 'Never' : dateFormatter.format(new Date(iso));
}

/** 1 → "1 day", 45 → "45 days". */
export function formatDays(days: number): string {
  return `${days} ${days === 1 ? 'day' : 'days'}`;
}
