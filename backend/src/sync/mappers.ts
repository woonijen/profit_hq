import type { Types } from 'mongoose';
import type {
  ShopifyConnection,
  ShopifyMoneyBag,
  ShopifyOrder,
  ShopifyProduct,
} from '../shopify/schemas.js';
import { hashContent } from './content-hash.js';

/** A payload that cannot be turned into a valid document. The sync skips it and records why. */
export class MappingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MappingError';
  }
}

export interface MapContext {
  storeId: Types.ObjectId;
  /** Currency of the store; payloads in any other currency are rejected rather than summed. */
  currency: string;
}

/** Variant Shopify id → current unit cost in cents (null = unknown). Source of the COGS snapshot. */
export type CostLookup = ReadonlyMap<string, number | null>;

export interface MappedVariant {
  shopifyId: string;
  title: string;
  sku: string | null;
  priceCents: number;
  unitCostCents: number | null;
  inventoryQuantity: number;
}

export interface MappedProduct {
  storeId: Types.ObjectId;
  shopifyId: string;
  title: string;
  status: ShopifyProduct['status'];
  variants: MappedVariant[];
  shopifyUpdatedAt: Date;
  contentHash: string;
}

export interface MappedLineItem {
  shopifyId: string;
  productShopifyId: string | null;
  variantShopifyId: string | null;
  title: string;
  sku: string | null;
  quantity: number;
  /** Units of this line that were refunded, summed over all the order's refunds. */
  refundedQuantity: number;
  unitPriceCents: number;
  discountCents: number;
  unitCostCents: number | null;
}

export interface MappedRefund {
  shopifyId: string;
  processedAt: Date;
  amountCents: number;
  lineItems: { lineItemShopifyId: string; quantity: number }[];
}

export interface MappedOrder {
  storeId: Types.ObjectId;
  shopifyId: string;
  name: string;
  processedAt: Date;
  financialStatus: ShopifyOrder['displayFinancialStatus'];
  currency: string;
  grossCents: number;
  discountCents: number;
  taxCents: number;
  refundedCents: number;
  lineItems: MappedLineItem[];
  refunds: MappedRefund[];
  customerShopifyId: string | null;
  customerEmail: string | null;
  shopifyUpdatedAt: Date;
  contentHash: string;
}

/**
 * Converts a Shopify decimal string ("12.50") to integer cents without going through floats.
 * Amounts with more than two decimals are rounded half up.
 */
export function toCents(amount: string): number {
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(amount);
  if (!match) throw new MappingError(`Invalid money amount "${amount}"`);

  const [, sign, whole = '0', fraction = ''] = match;
  let cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0').slice(0, 2));
  if (fraction.length > 2 && Number(fraction[2]) >= 5) cents += 1;

  if (!Number.isSafeInteger(cents)) throw new MappingError(`Money amount "${amount}" is too large`);
  if (sign && cents > 0) throw new MappingError(`Negative money amount "${amount}"`);
  return cents;
}

function moneyToCents({ shopMoney }: ShopifyMoneyBag, currency: string): number {
  if (shopMoney.currencyCode !== currency) {
    throw new MappingError(`Expected currency ${currency}, got ${shopMoney.currencyCode}`);
  }
  return toCents(shopMoney.amount);
}

/**
 * Unwraps a connection that is expected to arrive whole. The sync only paginates top-level
 * lists, so a nested list with more pages would be silently truncated; fail loudly instead.
 */
function nodesOf<T>(connection: ShopifyConnection<T>, label: string): T[] {
  if (connection.pageInfo.hasNextPage) {
    throw new MappingError(`${label} has more than one page, which the sync does not support`);
  }
  return connection.edges.map((edge) => edge.node);
}

export function mapProduct(ctx: MapContext, product: ShopifyProduct): MappedProduct {
  const variants = nodesOf(product.variants, 'Product variants').map((variant): MappedVariant => ({
    shopifyId: variant.id,
    title: variant.title,
    sku: variant.sku,
    priceCents: toCents(variant.price),
    unitCostCents: variant.inventoryItem.unitCost
      ? moneyToCents({ shopMoney: variant.inventoryItem.unitCost }, ctx.currency)
      : null,
    // Shopify reports null for untracked inventory; treated as 0 for now.
    inventoryQuantity: variant.inventoryQuantity ?? 0,
  }));

  const fields = {
    shopifyId: product.id,
    title: product.title,
    status: product.status,
    variants,
    shopifyUpdatedAt: new Date(product.updatedAt),
  };
  return { storeId: ctx.storeId, ...fields, contentHash: hashContent(fields) };
}

/**
 * Maps an order. `costs` supplies the COGS snapshot for new lines; the hash deliberately leaves
 * it out, so a later cost change does not make an unchanged order look changed (the sync keeps
 * the snapshot already stored on existing lines).
 */
export function mapOrder(ctx: MapContext, order: ShopifyOrder, costs: CostLookup): MappedOrder {
  if (order.currencyCode !== ctx.currency) {
    throw new MappingError(`Expected currency ${ctx.currency}, got ${order.currencyCode}`);
  }

  const lines = nodesOf(order.lineItems, 'Order line items').map((line) => ({
    shopifyId: line.id,
    productShopifyId: line.product?.id ?? null,
    variantShopifyId: line.variant?.id ?? null,
    title: line.title,
    sku: line.sku,
    quantity: line.quantity,
    unitPriceCents: moneyToCents(line.originalUnitPriceSet, ctx.currency),
    discountCents: moneyToCents(line.totalDiscountSet, ctx.currency),
  }));

  const grossCents = lines.reduce((sum, line) => sum + line.unitPriceCents * line.quantity, 0);
  const discountCents = moneyToCents(order.totalDiscountsSet, ctx.currency);
  const subtotalCents = moneyToCents(order.subtotalPriceSet, ctx.currency);
  if (grossCents - discountCents !== subtotalCents) {
    throw new MappingError(
      `Line items (${grossCents}) minus discounts (${discountCents}) do not equal the subtotal (${subtotalCents})`,
    );
  }

  const refunds = order.refunds.map((refund): MappedRefund => ({
    shopifyId: refund.id,
    processedAt: new Date(refund.createdAt),
    amountCents: moneyToCents(refund.totalRefundedSet, ctx.currency),
    lineItems: nodesOf(refund.refundLineItems, 'Refund line items').map((item) => ({
      lineItemShopifyId: item.lineItem.id,
      quantity: item.quantity,
    })),
  }));
  const refundedCents = moneyToCents(order.totalRefundedSet, ctx.currency);
  const refundsTotal = refunds.reduce((sum, refund) => sum + refund.amountCents, 0);
  if (refundsTotal !== refundedCents) {
    throw new MappingError(
      `Refunds (${refundsTotal}) do not add up to the order's refunded total (${refundedCents})`,
    );
  }

  const refundedUnits = new Map<string, number>();
  for (const refund of refunds) {
    for (const item of refund.lineItems) {
      const total = (refundedUnits.get(item.lineItemShopifyId) ?? 0) + item.quantity;
      refundedUnits.set(item.lineItemShopifyId, total);
    }
  }
  const linesWithRefunds = lines.map((line) => {
    const refundedQuantity = refundedUnits.get(line.shopifyId) ?? 0;
    if (refundedQuantity > line.quantity) {
      throw new MappingError(
        `Line ${line.shopifyId} refunds ${refundedQuantity} units but only ${line.quantity} were sold`,
      );
    }
    return { ...line, refundedQuantity };
  });

  const fields = {
    shopifyId: order.id,
    name: order.name,
    processedAt: new Date(order.processedAt),
    financialStatus: order.displayFinancialStatus,
    currency: order.currencyCode,
    grossCents,
    discountCents,
    taxCents: moneyToCents(order.totalTaxSet, ctx.currency),
    refundedCents,
    lineItems: linesWithRefunds,
    refunds,
    customerShopifyId: order.customer?.id ?? null,
    customerEmail: order.customer?.email ?? null,
    shopifyUpdatedAt: new Date(order.updatedAt),
  };

  return {
    storeId: ctx.storeId,
    ...fields,
    lineItems: linesWithRefunds.map((line) => ({
      ...line,
      unitCostCents: line.variantShopifyId ? (costs.get(line.variantShopifyId) ?? null) : null,
    })),
    contentHash: hashContent(fields),
  };
}
