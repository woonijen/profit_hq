interface SortableHeaderProps<T extends string> {
  label: string;
  column: T;
  activeSort: T;
  direction: 'asc' | 'desc';
  onSort: (column: T) => void;
  /** Extra classes for the cell, e.g. the sticky header styles of a table that scrolls. */
  cellClassName?: string;
}

/** A column header that sorts the table. `aria-sort` tells screen readers which one is active. */
export function SortableHeader<T extends string>({
  label,
  column,
  activeSort,
  direction,
  onSort,
  cellClassName = '',
}: SortableHeaderProps<T>) {
  const active = column === activeSort;
  return (
    <th
      scope="col"
      aria-sort={active ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'}
      className={`${cellClassName} px-4 py-3 text-right font-medium`}
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
