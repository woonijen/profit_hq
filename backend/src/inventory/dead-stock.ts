/**
 * Dead-stock logic, kept free of the database so it can be tested with plain objects. The
 * service feeds it products and last-sale dates. Definitions: docs/dead-stock.md.
 */
import { localDate } from '../utils/date-range.js';
import { holdingCostCents } from './holding-cost.js';
import { type MarkdownSuggestion, suggestMarkdown } from './markdown.js';

export const DEAD_STOCK_WINDOWS = [30, 60, 90] as const;
export type DeadStockWindow = (typeof DEAD_STOCK_WINDOWS)[number];

export const DEAD_STOCK_SORTS = ['daysInactive', 'stockValue', 'quantity'] as const;
export type DeadStockSort = (typeof DEAD_STOCK_SORTS)[number];

export type SortDirection = 'asc' | 'desc';

const DAY_MS = 86_400_000;

/** A product as the dead-stock calculation needs it. */
export interface StockedProduct {
  shopifyId: string;
  title: string;
  /** When the product appeared in the shop; the idle clock of a variant that never sold. */
  createdAt: Date;
  variants: {
    shopifyId: string;
    title: string;
    sku: string | null;
    /** What the variant sells for now. */
    priceCents: number;
    unitCostCents: number | null;
    inventoryQuantity: number;
  }[];
}

export interface DeadStockItem extends MarkdownSuggestion {
  variantId: string;
  productId: string;
  productTitle: string;
  /** "Default Title" for single-variant products, as Shopify names them. */
  variantTitle: string;
  sku: string | null;
  inventoryQuantity: number;
  /** Current selling price, integer cents. */
  priceCents: number;
  /** null = the merchant never entered a cost. */
  unitCostCents: number | null;
  /** quantity × unit cost; null when the cost is unknown. */
  stockValueCents: number | null;
  /** Monthly cost of holding this stock at the store's rate; null when the cost is unknown. */
  holdingCostCents: number | null;
  /** null = never sold. */
  lastSoldAt: Date | null;
  /** Whole calendar days in the store's time zone since the last sale (or since creation). */
  daysInactive: number;
}

export interface DeadStockTotals {
  /** Variants that are dead stock, over all pages. */
  variants: number;
  units: number;
  /** Capital tied up: the stock value of the variants whose cost is known. */
  stockValueCents: number;
  /** Monthly holding cost of the variants whose cost is known: the sum of the rows' costs. */
  monthlyHoldingCostCents: number;
  /** Dead variants without a cost, which are left out of both money totals. */
  variantsMissingCost: number;
}

export interface DeadStockQuery {
  window: DeadStockWindow;
  sort: DeadStockSort;
  direction: SortDirection;
  /** 1-based. */
  page: number;
  pageSize: number;
}

export interface DeadStockReport {
  window: DeadStockWindow;
  asOf: Date;
  /** The store's monthly holding cost rate the costs were worked out with (0.02 = 2%). */
  holdingCostRate: number;
  totals: DeadStockTotals;
  items: DeadStockItem[];
  page: { number: number; size: number; totalItems: number; totalPages: number };
}

/** The calendar day of `instant` in `timeZone`, as a day count (comparable, DST-proof). */
function dayNumber(instant: Date, timeZone: string): number {
  const { year, month, day } = localDate(instant, timeZone);
  return Date.UTC(year, month - 1, day) / DAY_MS;
}

/**
 * Calendar days from `since` to `now` in the store's time zone: 0 for something that happened
 * today, 1 for yesterday. A variant is dead for a window of N days exactly when this is ≥ N,
 * i.e. when it did not sell on any of the last N calendar days (today included).
 */
export function daysInactive(since: Date, now: Date, timeZone: string): number {
  return Math.max(0, dayNumber(now, timeZone) - dayNumber(since, timeZone));
}

/**
 * Every in-stock variant that did not sell in the last `window` days. `lastSoldAt` maps a
 * variant id to its last sale; absent means it never sold. `holdingCostRate` prices the
 * monthly holding cost of every row. Archived and draft products must be filtered out by the
 * caller. Unsorted.
 */
export function findDeadStock(
  products: readonly StockedProduct[],
  lastSoldAt: ReadonlyMap<string, Date>,
  window: DeadStockWindow,
  timeZone: string,
  now: Date,
  holdingCostRate: number,
): DeadStockItem[] {
  const items: DeadStockItem[] = [];
  for (const product of products) {
    for (const variant of product.variants) {
      if (variant.inventoryQuantity <= 0) continue;

      const soldAt = lastSoldAt.get(variant.shopifyId) ?? null;
      const idleDays = daysInactive(soldAt ?? product.createdAt, now, timeZone);
      if (idleDays < window) continue;

      items.push({
        variantId: variant.shopifyId,
        productId: product.shopifyId,
        productTitle: product.title,
        variantTitle: variant.title,
        sku: variant.sku,
        inventoryQuantity: variant.inventoryQuantity,
        priceCents: variant.priceCents,
        unitCostCents: variant.unitCostCents,
        stockValueCents:
          variant.unitCostCents === null ? null : variant.unitCostCents * variant.inventoryQuantity,
        holdingCostCents: holdingCostCents(
          variant.inventoryQuantity,
          variant.unitCostCents,
          holdingCostRate,
        ),
        lastSoldAt: soldAt,
        daysInactive: idleDays,
        ...suggestMarkdown(idleDays, variant.priceCents, variant.unitCostCents),
      });
    }
  }
  return items;
}

export function totalDeadStock(items: readonly DeadStockItem[]): DeadStockTotals {
  return {
    variants: items.length,
    units: items.reduce((sum, item) => sum + item.inventoryQuantity, 0),
    stockValueCents: items.reduce((sum, item) => sum + (item.stockValueCents ?? 0), 0),
    monthlyHoldingCostCents: items.reduce((sum, item) => sum + (item.holdingCostCents ?? 0), 0),
    variantsMissingCost: items.filter((item) => item.stockValueCents === null).length,
  };
}

const SORT_KEYS: Record<DeadStockSort, (item: DeadStockItem) => number | null> = {
  daysInactive: (item) => item.daysInactive,
  stockValue: (item) => item.stockValueCents,
  quantity: (item) => item.inventoryQuantity,
};

/**
 * Sorts by the chosen column, rows without a value (unknown cost) always last, ties broken by
 * product title and variant id so paging is stable. Returns a new array.
 */
export function sortDeadStock(
  items: readonly DeadStockItem[],
  sort: DeadStockSort,
  direction: SortDirection,
): DeadStockItem[] {
  const key = SORT_KEYS[sort];
  const sign = direction === 'asc' ? 1 : -1;
  return [...items].sort((a, b) => {
    const left = key(a);
    const right = key(b);
    if (left !== right) {
      if (left === null) return 1;
      if (right === null) return -1;
      return (left - right) * sign;
    }
    return a.productTitle.localeCompare(b.productTitle) || a.variantId.localeCompare(b.variantId);
  });
}

/** The full report: dead variants, totals over all of them, and the requested page. */
export function buildDeadStockReport(
  products: readonly StockedProduct[],
  lastSoldAt: ReadonlyMap<string, Date>,
  query: DeadStockQuery,
  timeZone: string,
  now: Date,
  holdingCostRate: number,
): DeadStockReport {
  const dead = findDeadStock(products, lastSoldAt, query.window, timeZone, now, holdingCostRate);
  const sorted = sortDeadStock(dead, query.sort, query.direction);
  const start = (query.page - 1) * query.pageSize;

  return {
    window: query.window,
    asOf: now,
    holdingCostRate,
    totals: totalDeadStock(dead),
    items: sorted.slice(start, start + query.pageSize),
    page: {
      number: query.page,
      size: query.pageSize,
      totalItems: dead.length,
      totalPages: Math.ceil(dead.length / query.pageSize),
    },
  };
}
