/**
 * Classes for a table that scrolls inside its own box: the header row stays at the top and the
 * first column stays at the left. Cells are sticky one by one (a sticky `<thead>` is less
 * reliable) and need a background to hide what scrolls beneath them. The header line is a
 * shadow because a border on a sticky cell stays behind when the table collapses its borders.
 * Stacking: the corner cell is above the header cells, which are above the pinned column.
 */
const HEAD_LINE = 'shadow-[inset_0_-1px_0_var(--line)]';

/** A header cell. */
export const HEAD_CELL = `sticky top-0 z-20 bg-card ${HEAD_LINE}`;

/** The header cell of the pinned first column. */
export const CORNER_HEAD_CELL = `sticky top-0 left-0 z-30 bg-card ${HEAD_LINE}`;

/** The first cell of a body row. */
export const PINNED_CELL = 'sticky left-0 z-10 bg-card';

/** The box around a table: it scrolls both ways and is reachable by keyboard. */
export const TABLE_SCROLL_BOX =
  'min-h-0 overflow-auto rounded-lg border border-line bg-card shadow-sm';
