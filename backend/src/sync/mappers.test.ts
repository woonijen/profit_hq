import { Types } from 'mongoose';
import { describe, expect, it } from 'vitest';
import { FINANCIAL_STATUSES } from '../models/order.model.js';
import { PRODUCT_STATUSES } from '../models/product.model.js';
import { generateMockShop } from '../shopify/mock/generator.js';
import { orderSchema, productSchema, type ShopifyOrder } from '../shopify/schemas.js';
import {
  type CostLookup,
  type MapContext,
  mapOrder,
  mapProduct,
  MappingError,
  toCents,
} from './mappers.js';

const ctx: MapContext = { storeId: new Types.ObjectId(), currency: 'USD' };
const shop = generateMockShop({
  seed: 42,
  days: 30,
  endDate: new Date('2026-01-01T00:00:00Z'),
});

/** An order with a discount, so the money checks have something to bite on. */
function sampleOrder(): ShopifyOrder {
  const order = shop.orders.find(
    (o) => Number(o.totalDiscountsSet.shopMoney.amount) > 0 && o.refunds.length === 0,
  );
  if (!order) throw new Error('mock data has no discounted order');
  return structuredClone(order);
}

describe('toCents', () => {
  it.each([
    ['12.50', 1250],
    ['0.99', 99],
    ['19', 1900],
    ['0.1', 10],
    ['0.00', 0],
    ['-0.00', 0],
    ['1.005', 101], // third decimal rounds half up
    ['0.999', 100],
  ])('converts %s to %i', (input, expected) => {
    expect(toCents(input)).toBe(expected);
  });

  it.each(['', 'abc', '1.2.3', '1,50', '-1.00'])('rejects %j', (input) => {
    expect(() => toCents(input)).toThrow(MappingError);
  });
});

describe('mapProduct', () => {
  const product = shop.products[0];
  if (!product) throw new Error('mock data has no products');

  it('maps variants and converts money to cents', () => {
    const mapped = mapProduct(ctx, product);
    const variant = product.variants.edges[0]?.node;
    expect(mapped.shopifyId).toBe(product.id);
    expect(mapped.variants).toHaveLength(product.variants.edges.length);
    expect(mapped.variants[0]?.priceCents).toBe(toCents(variant?.price ?? ''));
  });

  it('keeps when the product was created, for dead-stock aging', () => {
    expect(mapProduct(ctx, product).shopifyCreatedAt).toEqual(new Date(product.createdAt));
  });

  it('keeps an unknown cost as null rather than 0', () => {
    const unknownCost = structuredClone(product);
    for (const edge of unknownCost.variants.edges) edge.node.inventoryItem.unitCost = null;
    expect(mapProduct(ctx, unknownCost).variants.every((v) => v.unitCostCents === null)).toBe(true);
  });

  it('produces the same hash on every run and a new one when the payload changes', () => {
    const hash = mapProduct(ctx, product).contentHash;
    expect(mapProduct(ctx, structuredClone(product)).contentHash).toBe(hash);
    expect(mapProduct(ctx, { ...product, title: 'Renamed' }).contentHash).not.toBe(hash);
  });
});

describe('mapOrder', () => {
  const noCosts: CostLookup = new Map();

  it('maps every generated order, and gross − discounts − refunds adds up', () => {
    for (const order of shop.orders) {
      const mapped = mapOrder(ctx, order, noCosts);
      expect(mapped.grossCents - mapped.discountCents).toBe(
        toCents(order.subtotalPriceSet.shopMoney.amount),
      );
      expect(mapped.refundedCents).toBe(toCents(order.totalRefundedSet.shopMoney.amount));
    }
  });

  it('snapshots the variant cost onto each line, null when unknown', () => {
    const order = sampleOrder();
    const [first, ...rest] = order.lineItems.edges.map((e) => e.node.variant?.id ?? '');
    const costs: CostLookup = new Map([[first ?? '', 700]]);
    const lines = mapOrder(ctx, order, costs).lineItems;

    expect(lines[0]?.unitCostCents).toBe(700);
    expect(lines.slice(1).every((l) => l.unitCostCents === null)).toBe(true);
    expect(rest.length).toBe(lines.length - 1);
  });

  it('treats a line whose variant was deleted as cost unknown', () => {
    const order = sampleOrder();
    for (const edge of order.lineItems.edges) edge.node.variant = null;
    const costs: CostLookup = new Map([['gid://shopify/ProductVariant/4000001', 100]]);
    expect(mapOrder(ctx, order, costs).lineItems.every((l) => l.unitCostCents === null)).toBe(true);
  });

  it('does not let a cost change alter the content hash', () => {
    const order = sampleOrder();
    const variantIds = order.lineItems.edges.map((e) => e.node.variant?.id ?? '');
    const costs: CostLookup = new Map(variantIds.map((id) => [id, 999]));
    expect(mapOrder(ctx, order, costs).contentHash).toBe(mapOrder(ctx, order, noCosts).contentHash);
  });

  it('changes the content hash when Shopify data changes', () => {
    const order = sampleOrder();
    const changed = { ...order, displayFinancialStatus: 'VOIDED' as const };
    expect(mapOrder(ctx, changed, noCosts).contentHash).not.toBe(
      mapOrder(ctx, order, noCosts).contentHash,
    );
  });

  it('records how many units of each line were refunded', () => {
    const order = shop.orders.find((o) => o.refunds.length > 0);
    if (!order) throw new Error('mock data has no refunded order');

    const mapped = mapOrder(ctx, order, noCosts);
    const expected = new Map<string, number>();
    for (const refund of order.refunds) {
      for (const { node } of refund.refundLineItems.edges) {
        expected.set(node.lineItem.id, (expected.get(node.lineItem.id) ?? 0) + node.quantity);
      }
    }

    for (const line of mapped.lineItems) {
      expect(line.refundedQuantity).toBe(expected.get(line.shopifyId) ?? 0);
    }
    expect(mapped.lineItems.some((line) => line.refundedQuantity > 0)).toBe(true);
  });

  it('rejects a refund of more units than were sold', () => {
    const order = shop.orders.find((o) => o.refunds.length > 0);
    if (!order) throw new Error('mock data has no refunded order');
    const tampered = structuredClone(order);
    const item = tampered.refunds[0]?.refundLineItems.edges[0]?.node;
    if (!item) throw new Error('refund has no lines');
    item.quantity = 99;
    expect(() => mapOrder(ctx, tampered, noCosts)).toThrow(/units/);
  });

  it('rejects an order in another currency', () => {
    expect(() => mapOrder({ ...ctx, currency: 'EUR' }, sampleOrder(), noCosts)).toThrow(
      MappingError,
    );
  });

  it('rejects lines that do not add up to the subtotal', () => {
    const order = sampleOrder();
    order.subtotalPriceSet.shopMoney.amount = '0.01';
    expect(() => mapOrder(ctx, order, noCosts)).toThrow(/subtotal/);
  });

  it('rejects refunds that do not add up to the refunded total', () => {
    const order = shop.orders.find((o) => o.refunds.length > 0);
    if (!order) throw new Error('mock data has no refunded order');
    const tampered = structuredClone(order);
    tampered.totalRefundedSet.shopMoney.amount = '0.01';
    expect(() => mapOrder(ctx, tampered, noCosts)).toThrow(/Refunds/);
  });

  it('refuses a nested list that would be truncated', () => {
    const order = sampleOrder();
    order.lineItems.pageInfo.hasNextPage = true;
    expect(() => mapOrder(ctx, order, noCosts)).toThrow(/more than one page/);
  });
});

describe('enums copied between the Zod schemas and the models', () => {
  it('stay in sync', () => {
    expect(orderSchema.shape.displayFinancialStatus.options).toEqual([...FINANCIAL_STATUSES]);
    expect(productSchema.shape.status.options).toEqual([...PRODUCT_STATUSES]);
  });
});
