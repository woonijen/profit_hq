interface PaginationProps {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}

const buttonClass =
  'rounded-md border border-line-strong bg-card px-3 py-1.5 text-sm font-medium hover:bg-hover disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-card';

/** Previous / next, with the position announced politely when it changes. */
export function Pagination({ page, totalPages, onChange }: PaginationProps) {
  if (totalPages <= 1) return null;
  return (
    <nav aria-label="Pagination" className="flex items-center justify-between gap-3">
      <button
        type="button"
        className={buttonClass}
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
      >
        Previous
      </button>
      <p aria-live="polite" className="text-sm text-ink-muted">
        Page {page} of {totalPages}
      </p>
      <button
        type="button"
        className={buttonClass}
        disabled={page >= totalPages}
        onClick={() => onChange(page + 1)}
      >
        Next
      </button>
    </nav>
  );
}
