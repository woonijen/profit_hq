import { describe, expect, it } from 'vitest';
import { type CustomerRow, numericShopifyId, toCustomerFacts } from './customer-pipeline.js';

const row = (overrides: Partial<CustomerRow>): CustomerRow => ({
  _id: 'gid://shopify/Customer/101',
  orders: 1,
  lastOrderAt: new Date('2026-01-10T10:00:00Z'),
  grossCents: 0,
  discountCents: 0,
  refundedCents: 0,
  latestEmail: null,
  latestName: null,
  ...overrides,
});

describe('numericShopifyId', () => {
  it('keeps the number after the last slash', () => {
    expect(numericShopifyId('gid://shopify/Customer/6000001')).toBe('6000001');
  });

  it('returns an id without a slash unchanged', () => {
    expect(numericShopifyId('42')).toBe('42');
  });
});

describe('toCustomerFacts', () => {
  it('works out lifetime spend as gross - discounts - refunds, in cents', () => {
    const { customers } = toCustomerFacts([
      row({ orders: 2, grossCents: 10_000, discountCents: 1_500, refundedCents: 2_500 }),
    ]);

    expect(customers[0]?.lifetimeSpendCents).toBe(6_000);
    expect(customers[0]?.orders).toBe(2);
  });

  it('gives a fully refunded customer a spend of 0 but still counts the order', () => {
    const { customers } = toCustomerFacts([
      row({ orders: 1, grossCents: 4_000, discountCents: 0, refundedCents: 4_000 }),
    ]);

    expect(customers[0]).toMatchObject({ lifetimeSpendCents: 0, orders: 1 });
  });

  it('identifies a customer by email, else by numeric Shopify id', () => {
    const at = new Date('2026-01-10T10:00:00Z');
    const { customers } = toCustomerFacts([
      row({ latestEmail: { at, value: 'ava@example.test' } }),
      row({ _id: 'gid://shopify/Customer/202' }),
    ]);

    expect(customers.map((c) => c.identifier)).toEqual(['ava@example.test', '202']);
  });

  it('takes the name from its own latest value, null when no order has one', () => {
    const at = new Date('2026-01-10T10:00:00Z');
    const { customers } = toCustomerFacts([
      row({ latestName: { at, value: 'Ava Nguyen' } }),
      row({ _id: 'gid://shopify/Customer/202' }),
    ]);

    expect(customers.map((c) => c.name)).toEqual(['Ava Nguyen', null]);
  });

  it('keeps guest checkouts out of the customers and counts their orders', () => {
    const { customers, guestOrders } = toCustomerFacts([
      row({ _id: null, orders: 7 }),
      row({ orders: 2 }),
    ]);

    expect(customers).toHaveLength(1);
    expect(guestOrders).toBe(7);
  });

  it('reports no guest orders when every order has a customer', () => {
    expect(toCustomerFacts([row({})]).guestOrders).toBe(0);
    expect(toCustomerFacts([])).toEqual({ customers: [], guestOrders: 0 });
  });
});
