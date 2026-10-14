import { describe, expect, it } from 'vitest';
import {
  buildDeadStockReport,
  daysInactive,
  findDeadStock,
  type DeadStockQuery,
  sortDeadStock,
  type StockedProduct,
  totalDeadStock,
} from './dead-stock.js';

// "Now" is Jan 31 2026, noon UTC. Day counts below are calendar days back from Jan 31.
const NOW = new Date('2026-01-31T12:00:00Z');

function variant(
  shopifyId: string,
  quantity: number,
  cost: number | null,
  title = 'Default Title',
): StockedProduct['variants'][number] {
  return { shopifyId, title, sku: null, unitCostCents: cost, inventoryQuantity: quantity };
}

function product(
  shopifyId: string,
  title: string,
  variants: StockedProduct['variants'],
  createdAt = '2025-06-01T00:00:00Z',
): StockedProduct {
  return { shopifyId, title, createdAt: new Date(createdAt), variants };
}

const sold = (entries: Record<string, string>) =>
  new Map(Object.entries(entries).map(([id, at]) => [id, new Date(at)]));

describe('daysInactive', () => {
  it('counts calendar days, not 24-hour spans', () => {
    // 23:59 yesterday is 1 day ago at 00:01 today, although only two minutes passed.
    const now = new Date('2026-01-31T00:01:00Z');
    expect(daysInactive(new Date('2026-01-30T23:59:00Z'), now, 'UTC')).toBe(1);
    expect(daysInactive(new Date('2026-01-31T00:00:00Z'), now, 'UTC')).toBe(0);
  });

  it('reads the dates in the store time zone', () => {
    // Jan 1 02:00 UTC is still Dec 31 evening in Los Angeles; "now" is Jan 31 04:00 there.
    const lastSale = new Date('2026-01-01T02:00:00Z');
    expect(daysInactive(lastSale, NOW, 'UTC')).toBe(30);
    expect(daysInactive(lastSale, NOW, 'America/Los_Angeles')).toBe(31);
  });

  it('never goes negative', () => {
    expect(daysInactive(new Date('2026-02-05T00:00:00Z'), NOW, 'UTC')).toBe(0);
  });
});

describe('findDeadStock', () => {
  const products = [
    product('P1', 'Mug', [
      variant('V-today', 10, 500), // sold today: 0 days
      variant('V-29', 5, 1000), // last sale Jan 2: 29 days, one short of the 30-day window
      variant('V-30', 4, 200), // Jan 1: 30 days, dead for 30d
      variant('V-60', 3, 100), // Dec 2: 60 days, dead for 30d and 60d
      variant('V-95', 2, 100), // Oct 28: 95 days, dead for all three
    ]),
    product(
      'P2',
      'Tote',
      [
        variant('V-empty', 0, 100), // no stock, nothing to be stuck with
        variant('V-never', 7, 300), // never sold; product created Nov 2 = 90 days ago
      ],
      '2025-11-02T00:00:00Z',
    ),
    product('P3', 'Brand New', [variant('V-new', 9, 400)], '2026-01-25T00:00:00Z'), // 6 days old
    product('P4', 'No Cost', [variant('V-nocost', 6, null)], '2025-10-01T00:00:00Z'),
  ];
  const lastSold = sold({
    'V-today': '2026-01-31T09:00:00Z',
    'V-29': '2026-01-02T08:00:00Z',
    'V-30': '2026-01-01T08:00:00Z',
    'V-60': '2025-12-02T08:00:00Z',
    'V-95': '2025-10-28T08:00:00Z',
    'V-empty': '2025-08-01T00:00:00Z',
  });

  const idsFor = (window: 30 | 60 | 90) =>
    findDeadStock(products, lastSold, window, 'UTC', NOW)
      .map((item) => item.variantId)
      .sort();

  it('flags variants idle for at least the window, boundary included', () => {
    expect(idsFor(30)).toEqual(['V-30', 'V-60', 'V-95', 'V-never', 'V-nocost']);
    expect(idsFor(60)).toEqual(['V-60', 'V-95', 'V-never', 'V-nocost']);
    expect(idsFor(90)).toEqual(['V-95', 'V-never', 'V-nocost']);
  });

  it('times a variant that never sold from the creation of its product', () => {
    const [never] = findDeadStock(products, lastSold, 90, 'UTC', NOW).filter(
      (item) => item.variantId === 'V-never',
    );
    expect(never).toMatchObject({ lastSoldAt: null, daysInactive: 90 });
  });

  it('does not flag a new product that has not sold yet', () => {
    expect(idsFor(30)).not.toContain('V-new');
  });

  it('values the stock, or reports an unknown value when the cost is missing', () => {
    const items = findDeadStock(products, lastSold, 30, 'UTC', NOW);
    const byId = new Map(items.map((item) => [item.variantId, item]));

    expect(byId.get('V-30')).toMatchObject({ inventoryQuantity: 4, stockValueCents: 800 });
    expect(byId.get('V-nocost')).toMatchObject({ unitCostCents: null, stockValueCents: null });
  });
});

describe('totalDeadStock', () => {
  it('sums units and known value, and counts the variants without a cost', () => {
    const items = findDeadStock(
      [
        product('P', 'A', [
          variant('a', 4, 200), // value 800
          variant('b', 3, 100), // value 300
          variant('c', 6, null), // unknown
        ]),
      ],
      new Map(),
      30,
      'UTC',
      NOW,
    );

    expect(totalDeadStock(items)).toEqual({
      variants: 3,
      units: 13,
      stockValueCents: 1100,
      variantsMissingCost: 1,
    });
  });
});

describe('sortDeadStock and paging', () => {
  const products = [
    product('P1', 'Alpha', [variant('a', 10, 100)]), // value 1000
    product('P2', 'Bravo', [variant('b', 2, 900)]), // value 1800
    product('P3', 'Charlie', [variant('c', 5, null)]), // unknown
    product('P4', 'Delta', [variant('d', 10, 50)]), // value 500
  ];
  const lastSold = sold({
    a: '2025-12-01T00:00:00Z', // 61 days
    b: '2025-12-01T00:00:00Z', // 61 days
    c: '2025-11-01T00:00:00Z', // 91 days
    d: '2025-12-15T00:00:00Z', // 47 days
  });
  const items = findDeadStock(products, lastSold, 30, 'UTC', NOW);
  const order = (sort: Parameters<typeof sortDeadStock>[1], dir: 'asc' | 'desc') =>
    sortDeadStock(items, sort, dir).map((item) => item.variantId);

  it('sorts by days inactive, breaking ties by product title', () => {
    expect(order('daysInactive', 'desc')).toEqual(['c', 'a', 'b', 'd']);
    expect(order('daysInactive', 'asc')).toEqual(['d', 'a', 'b', 'c']);
  });

  it('sorts by stock value with unknown values always last', () => {
    expect(order('stockValue', 'desc')).toEqual(['b', 'a', 'd', 'c']);
    expect(order('stockValue', 'asc')).toEqual(['d', 'a', 'b', 'c']);
  });

  it('sorts by quantity', () => {
    expect(order('quantity', 'desc')).toEqual(['a', 'd', 'c', 'b']);
  });

  it('pages the sorted rows while the totals still cover all of them', () => {
    const query: DeadStockQuery = {
      window: 30,
      sort: 'daysInactive',
      direction: 'desc',
      page: 2,
      pageSize: 3,
    };
    const report = buildDeadStockReport(products, lastSold, query, 'UTC', NOW);

    expect(report.items.map((item) => item.variantId)).toEqual(['d']);
    expect(report.page).toEqual({ number: 2, size: 3, totalItems: 4, totalPages: 2 });
    expect(report.totals).toMatchObject({ variants: 4, units: 27, stockValueCents: 3300 });
  });

  it('returns an empty page past the end', () => {
    const query: DeadStockQuery = {
      window: 30,
      sort: 'quantity',
      direction: 'asc',
      page: 5,
      pageSize: 3,
    };
    const report = buildDeadStockReport(products, lastSold, query, 'UTC', NOW);

    expect(report.items).toEqual([]);
    expect(report.page.totalItems).toBe(4);
  });
});
