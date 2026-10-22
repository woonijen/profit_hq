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
  /** Current selling price, integer cents. */
  priceCents: number;
  /** Integer cents; null when the merchant never entered a cost. */
  unitCostCents: number | null;
  /** Integer cents; null when the cost is unknown. */
  stockValueCents: number | null;
  /** Integer cents per month at the store's holding cost rate; null when the cost is unknown. */
  holdingCostCents: number | null;
  /** ISO date-time; null = never sold. */
  lastSoldAt: string | null;
  /** Calendar days since the last sale (or since creation, if it never sold). */
  daysInactive: number;
  /** Markdown tier by days inactive: 15, 30 or 50 (0 only below 30 days, which a report never has). */
  suggestedDiscountPct: number;
  /** Current price less the suggested discount, integer cents. */
  suggestedPriceCents: number;
  /** Profit per unit at the suggested price (negative = a loss); null when the cost is unknown. */
  marginAfterMarkdownCents: number | null;
  /** The suggested price is under the unit cost. */
  belowCost: boolean;
}

export interface DeadStockReport {
  window: DeadStockWindow;
  asOf: string;
  /** The store's monthly holding cost rate the costs were worked out with; 0.02 = 2%. */
  holdingCostRate: number;
  /** Over all pages. */
  totals: {
    variants: number;
    units: number;
    /** Capital tied up; variants without a cost are not part of it. */
    stockValueCents: number;
    /** Monthly holding cost of the variants with a known cost. */
    monthlyHoldingCostCents: number;
    variantsMissingCost: number;
  };
  items: DeadStockItem[];
  page: { number: number; size: number; totalItems: number; totalPages: number };
}
