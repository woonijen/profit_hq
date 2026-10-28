import { describe, expect, it } from 'vitest';
import type { CustomerFacts } from './customer-pipeline.js';
import {
  buildCustomerSegmentsReport,
  type CustomerSegmentsQuery,
  sortCustomers,
  classifyCustomers,
} from './customer-report.js';

// "Now" is Jan 31 2026, noon UTC; the days in the comments are calendar days back from then.
const NOW = new Date('2026-01-31T12:00:00Z');

function customer(
  id: string,
  lastOrder: string,
  orders: number,
  lifetimeSpendCents: number,
  name: string | null = null,
): CustomerFacts {
  return {
    customerId: `gid://shopify/Customer/${id}`,
    identifier: `${id}@example.test`,
    name,
    orders,
    lastOrderAt: new Date(`${lastOrder}T10:00:00Z`),
    lifetimeSpendCents,
  };
}

const CUSTOMERS = [
  customer('a', '2026-01-31', 3, 30_000), // 0 days, 3 orders: VIP
  customer('b', '2026-01-01', 5, 50_000), // 30 days, 5 orders: VIP (last recent day)
  customer('c', '2025-12-31', 4, 20_000), // 31 days: At-Risk
  customer('d', '2025-12-02', 1, 10_000), // 60 days: At-Risk (last day)
  customer('e', '2025-12-01', 2, 0), // 61 days, refunded in full: Churned
  customer('f', '2026-01-25', 1, 5_000), // 6 days, 1 order: Active
];
// Total spend 115,000.

const query = (overrides: Partial<CustomerSegmentsQuery> = {}): CustomerSegmentsQuery => ({
  sort: 'lifetimeSpend',
  direction: 'desc',
  page: 1,
  pageSize: 25,
  ...overrides,
});

const ids = (report: { items: { identifier: string }[] }) =>
  report.items.map((item) => item.identifier.split('@')[0]);

describe('classifyCustomers', () => {
  it('counts calendar days in the store time zone and picks the segment', () => {
    const rows = classifyCustomers(CUSTOMERS, 'UTC', NOW);

    expect(rows.map((r) => [r.daysSinceLastOrder, r.segment])).toEqual([
      [0, 'VIP'],
      [30, 'VIP'],
      [31, 'AT_RISK'],
      [60, 'AT_RISK'],
      [61, 'CHURNED'],
      [6, 'ACTIVE'],
    ]);
  });

  it('reads the day in the store time zone, not UTC', () => {
    // 02:00 UTC on Jan 31 is still the evening of Jan 30 in New York; at 12:00 UTC on Jan 31
    // it is Jan 31 in both zones, so the customer is one day older in New York.
    const evening = {
      ...customer('x', '2026-01-31', 1, 100),
      lastOrderAt: new Date('2026-01-31T02:00:00Z'),
    };

    expect(classifyCustomers([evening], 'UTC', NOW)[0]?.daysSinceLastOrder).toBe(0);
    expect(classifyCustomers([evening], 'America/New_York', NOW)[0]?.daysSinceLastOrder).toBe(1);
  });
});

describe('buildCustomerSegmentsReport summary', () => {
  const { summary } = buildCustomerSegmentsReport(CUSTOMERS, 4, query(), 'UTC', NOW);

  it('counts every customer and reports the guest orders left out', () => {
    expect(summary.customers).toBe(6);
    expect(summary.guestOrders).toBe(4);
  });

  it('works out customers, spend, share and average spend per segment', () => {
    expect(summary.segments.VIP).toEqual({
      customers: 2,
      lifetimeSpendCents: 80_000,
      shareOfRevenue: 80_000 / 115_000,
      averageSpendCents: 40_000,
    });
    expect(summary.segments.AT_RISK).toMatchObject({
      customers: 2,
      lifetimeSpendCents: 30_000,
      averageSpendCents: 15_000,
    });
    expect(summary.segments.CHURNED).toEqual({
      customers: 1,
      lifetimeSpendCents: 0,
      shareOfRevenue: 0,
      averageSpendCents: 0,
    });
    expect(summary.segments.ACTIVE).toMatchObject({ customers: 1, lifetimeSpendCents: 5_000 });
  });

  it('adds the shares up to 100%', () => {
    const total = Object.values(summary.segments).reduce(
      (sum, segment) => sum + (segment.shareOfRevenue ?? 0),
      0,
    );
    expect(total).toBeCloseTo(1);
  });

  it('rounds the average spend to a cent', () => {
    const odd = [customer('p', '2026-01-30', 1, 100), customer('q', '2026-01-30', 1, 101)];
    const result = buildCustomerSegmentsReport(odd, 0, query(), 'UTC', NOW);

    expect(result.summary.segments.ACTIVE.averageSpendCents).toBe(101); // 100.5 rounds up
  });

  it('has null shares and zero averages when there are no customers', () => {
    const empty = buildCustomerSegmentsReport([], 2, query(), 'UTC', NOW);

    expect(empty.summary.customers).toBe(0);
    expect(empty.summary.guestOrders).toBe(2);
    expect(empty.summary.segments.VIP).toEqual({
      customers: 0,
      lifetimeSpendCents: 0,
      shareOfRevenue: null,
      averageSpendCents: 0,
    });
    expect(empty.items).toEqual([]);
    expect(empty.page.totalPages).toBe(0);
  });
});

describe('buildCustomerSegmentsReport list', () => {
  it('lists customers by lifetime spend, highest first, by default', () => {
    const report = buildCustomerSegmentsReport(CUSTOMERS, 0, query(), 'UTC', NOW);

    expect(ids(report)).toEqual(['b', 'a', 'c', 'd', 'f', 'e']);
  });

  it('filters the list by segment but keeps the summary on everyone', () => {
    const report = buildCustomerSegmentsReport(
      CUSTOMERS,
      0,
      query({ segment: 'AT_RISK' }),
      'UTC',
      NOW,
    );

    expect(ids(report)).toEqual(['c', 'd']);
    expect(report.page.totalItems).toBe(2);
    expect(report.summary.customers).toBe(6);
    expect(report.summary.segments.VIP.customers).toBe(2);
  });

  it('pages the sorted list', () => {
    const second = buildCustomerSegmentsReport(
      CUSTOMERS,
      0,
      query({ page: 2, pageSize: 4 }),
      'UTC',
      NOW,
    );

    expect(ids(second)).toEqual(['f', 'e']);
    expect(second.page).toEqual({ number: 2, size: 4, totalItems: 6, totalPages: 2 });
  });

  it('returns an empty page past the end', () => {
    const report = buildCustomerSegmentsReport(CUSTOMERS, 0, query({ page: 9 }), 'UTC', NOW);

    expect(report.items).toEqual([]);
    expect(report.page.totalItems).toBe(6);
  });
});

describe('sortCustomers', () => {
  const rows = classifyCustomers(CUSTOMERS, 'UTC', NOW);
  const order = (sort: Parameters<typeof sortCustomers>[1], direction: 'asc' | 'desc') =>
    sortCustomers(rows, sort, direction).map((r) => r.identifier.split('@')[0]);

  it('sorts by order count', () => {
    expect(order('orders', 'desc')).toEqual(['b', 'c', 'a', 'e', 'd', 'f']);
    expect(order('orders', 'asc')).toEqual(['d', 'f', 'e', 'a', 'c', 'b']);
  });

  it('sorts by days since the last order: descending lists the longest silent first', () => {
    expect(order('lastOrder', 'desc')).toEqual(['e', 'd', 'c', 'b', 'f', 'a']);
    expect(order('lastOrder', 'asc')).toEqual(['a', 'f', 'b', 'c', 'd', 'e']);
  });

  it('breaks ties by identifier so paging is stable', () => {
    const tied = classifyCustomers(
      [customer('z', '2026-01-30', 1, 500), customer('m', '2026-01-30', 1, 500)],
      'UTC',
      NOW,
    );

    expect(sortCustomers(tied, 'lifetimeSpend', 'desc').map((r) => r.identifier)).toEqual([
      'm@example.test',
      'z@example.test',
    ]);
    expect(sortCustomers(tied, 'lifetimeSpend', 'asc').map((r) => r.identifier)).toEqual([
      'm@example.test',
      'z@example.test',
    ]);
  });
});
