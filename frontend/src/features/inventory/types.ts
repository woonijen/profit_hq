/** Mirrors the backend response of `/stores/:id/inventory/dead-stock` (see docs/dead-stock.md). */

export const DEAD_STOCK_WINDOWS = [30, 60, 90] as const;
export type DeadStockWindow = (typeof DEAD_STOCK_WINDOWS)[number];

export const DEAD_STOCK_SORTS = ['daysInactive', 'stockValue', 'quantity'] as const;
export type DeadStockSort = (typeof DEAD_STOCK_SORTS)[number];

export type SortDirection = 'asc' | 'desc';

export const DEFAULT_WINDOW: DeadStockWindow = 30;
export const DEFAULT_SORT: DeadStockSort = 'daysInactive';
export const DEFAULT_DIRECTION: SortDirection = 'desc';
export const PAGE_SIZE = 25;

export interface DeadStockQuery {
  window: DeadStockWindow;
  sort: DeadStockSort;
  direction: SortDirection;
  /** 1-based. */
  page: number;
}

export interface DeadStockItem {
  variantId: string;
  productId: string;
  productTitle: string;
  /** "Default Title" for single-variant products. */
  variantTitle: string;
  sku: string | null;
  inventoryQuantity: number;
  /** Integer cents; null when the merchant never entered a cost. */
  unitCostCents: number | null;
  /** Integer cents; null when the cost is unknown. */
  stockValueCents: number | null;
  /** ISO date-time; null = never sold. */
  lastSoldAt: string | null;
  /** Calendar days since the last sale (or since creation, if it never sold). */
  daysInactive: number;
}

export interface DeadStockReport {
  window: DeadStockWindow;
  asOf: string;
  /** Over all pages. */
  totals: {
    variants: number;
    units: number;
    /** Capital tied up; variants without a cost are not part of it. */
    stockValueCents: number;
    variantsMissingCost: number;
  };
  items: DeadStockItem[];
  page: { number: number; size: number; totalItems: number; totalPages: number };
}
