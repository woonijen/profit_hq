/**
 * The customer segments report, kept free of the database so it can be tested with plain
 * objects. The service feeds it the per-customer facts. Definitions: docs/retention.md.
 */
import { daysInactive, type SortDirection } from '../inventory/dead-stock.js';
import type { CustomerFacts } from './customer-pipeline.js';
import { CUSTOMER_SEGMENTS, type CustomerSegment, segmentFor } from './segments.js';

export const CUSTOMER_SORTS = ['lifetimeSpend', 'orders', 'lastOrder'] as const;
export type CustomerSort = (typeof CUSTOMER_SORTS)[number];

export interface CustomerSegmentsQuery {
  /** Only list customers of this segment. The summary still covers everyone. */
  segment?: CustomerSegment;
  sort: CustomerSort;
  direction: SortDirection;
  page: number;
  pageSize: number;
}

export interface CustomerRowOut {
  customerId: string;
  identifier: string;
  name: string | null;
  lifetimeSpendCents: number;
  orders: number;
  lastOrderAt: Date;
  /** Whole calendar days in the store's time zone since the last order. */
  daysSinceLastOrder: number;
  segment: CustomerSegment;
}

export interface SegmentSummary {
  customers: number;
  lifetimeSpendCents: number;
  /** This segment's spend ÷ the spend of all customers, 0–1. null when that is 0. */
  shareOfRevenue: number | null;
  /** Spend ÷ customers, rounded to a cent. 0 without customers. */
  averageSpendCents: number;
}

export interface CustomerSegmentsReport {
  asOf: Date;
  summary: {
    customers: number;
    /** Counted orders without a customer, which are left out of every figure here. */
    guestOrders: number;
    segments: Record<CustomerSegment, SegmentSummary>;
  };
  items: CustomerRowOut[];
  page: { number: number; size: number; totalItems: number; totalPages: number };
}

/** Days since the last order and the segment of every customer. */
export function classifyCustomers(
  customers: readonly CustomerFacts[],
  timeZone: string,
  now: Date,
): CustomerRowOut[] {
  return customers.map((customer) => {
    const daysSinceLastOrder = daysInactive(customer.lastOrderAt, now, timeZone);
    return {
      customerId: customer.customerId,
      identifier: customer.identifier,
      name: customer.name,
      lifetimeSpendCents: customer.lifetimeSpendCents,
      orders: customer.orders,
      lastOrderAt: customer.lastOrderAt,
      daysSinceLastOrder,
      segment: segmentFor(daysSinceLastOrder, customer.orders),
    };
  });
}

/** Customers, spend, share of revenue and average spend of every segment. */
export function summarizeSegments(
  rows: readonly CustomerRowOut[],
): Record<CustomerSegment, SegmentSummary> {
  const totalSpend = rows.reduce((sum, row) => sum + row.lifetimeSpendCents, 0);
  const summary = {} as Record<CustomerSegment, SegmentSummary>;
  for (const segment of CUSTOMER_SEGMENTS) {
    const inSegment = rows.filter((row) => row.segment === segment);
    const spend = inSegment.reduce((sum, row) => sum + row.lifetimeSpendCents, 0);
    summary[segment] = {
      customers: inSegment.length,
      lifetimeSpendCents: spend,
      shareOfRevenue: totalSpend > 0 ? spend / totalSpend : null,
      averageSpendCents: inSegment.length > 0 ? Math.round(spend / inSegment.length) : 0,
    };
  }
  return summary;
}

const SORT_KEYS: Record<CustomerSort, (row: CustomerRowOut) => number> = {
  lifetimeSpend: (row) => row.lifetimeSpendCents,
  orders: (row) => row.orders,
  lastOrder: (row) => row.daysSinceLastOrder,
};

/**
 * Sorts by the chosen column, ties broken by identifier and then customer id so paging is
 * stable. `lastOrder` sorts by days since the last order, so descending lists the longest
 * silent customers first. Returns a new array.
 */
export function sortCustomers(
  rows: readonly CustomerRowOut[],
  sort: CustomerSort,
  direction: SortDirection,
): CustomerRowOut[] {
  const key = SORT_KEYS[sort];
  const sign = direction === 'asc' ? 1 : -1;
  return [...rows].sort(
    (a, b) =>
      (key(a) - key(b)) * sign ||
      a.identifier.localeCompare(b.identifier) ||
      a.customerId.localeCompare(b.customerId),
  );
}

/** The full report: summary over every customer, and the requested page of the filtered list. */
export function buildCustomerSegmentsReport(
  customers: readonly CustomerFacts[],
  guestOrders: number,
  query: CustomerSegmentsQuery,
  timeZone: string,
  now: Date,
): CustomerSegmentsReport {
  const all = classifyCustomers(customers, timeZone, now);
  const listed = query.segment ? all.filter((row) => row.segment === query.segment) : all;
  const sorted = sortCustomers(listed, query.sort, query.direction);
  const start = (query.page - 1) * query.pageSize;

  return {
    asOf: now,
    summary: { customers: all.length, guestOrders, segments: summarizeSegments(all) },
    items: sorted.slice(start, start + query.pageSize),
    page: {
      number: query.page,
      size: query.pageSize,
      totalItems: listed.length,
      totalPages: Math.ceil(listed.length / query.pageSize),
    },
  };
}
