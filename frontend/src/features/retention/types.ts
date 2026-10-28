/** Mirrors the backend response of `/stores/:id/customers/segments` (see docs/retention.md). */

export const CUSTOMER_SEGMENTS = ['VIP', 'AT_RISK', 'CHURNED', 'ACTIVE'] as const;
export type CustomerSegment = (typeof CUSTOMER_SEGMENTS)[number];

export const CUSTOMER_SORTS = ['lifetimeSpend', 'orders', 'lastOrder'] as const;
export type CustomerSort = (typeof CUSTOMER_SORTS)[number];

export type SortDirection = 'asc' | 'desc';

export const DEFAULT_SORT: CustomerSort = 'lifetimeSpend';
export const DEFAULT_DIRECTION: SortDirection = 'desc';
export const PAGE_SIZE = 25;

export interface CustomerSegmentsQuery {
  /** Undefined lists every customer. */
  segment?: CustomerSegment;
  sort: CustomerSort;
  direction: SortDirection;
  /** 1-based. */
  page: number;
}

export interface CustomerRow {
  /** Shopify id of the customer. */
  customerId: string;
  /** The email of the latest order that has one, else the numeric Shopify id. */
  identifier: string;
  /** A display extra; null when no order carries a name. */
  name: string | null;
  /** Net revenue of their orders, integer cents. */
  lifetimeSpendCents: number;
  orders: number;
  /** ISO date-time. */
  lastOrderAt: string;
  /** Calendar days in the store's time zone since the last order. */
  daysSinceLastOrder: number;
  segment: CustomerSegment;
}

export interface SegmentSummary {
  customers: number;
  lifetimeSpendCents: number;
  /** This segment's spend ÷ the spend of all customers, 0–1; null when that is 0. */
  shareOfRevenue: number | null;
  /** Integer cents; 0 without customers. */
  averageSpendCents: number;
}

export interface CustomerSegmentsReport {
  asOf: string;
  /** Covers every customer, whatever the segment filter. */
  summary: {
    customers: number;
    /** Orders without a customer (guest checkouts), left out of every figure. */
    guestOrders: number;
    segments: Record<CustomerSegment, SegmentSummary>;
  };
  items: CustomerRow[];
  page: { number: number; size: number; totalItems: number; totalPages: number };
}
