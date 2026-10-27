import { z } from 'zod';

/**
 * Zod schemas for the slice of the Shopify Admin GraphQL API the sync consumes, simplified for
 * the simulation. Field names and nesting follow the real API (Order, LineItem, ProductVariant,
 * Customer, Refund; Relay-style connections; MoneyV2/MoneyBag; gid:// ids) so a real client can
 * return the same shapes. Known simplifications are called out where they occur.
 */

/** Global ID, e.g. `gid://shopify/Order/1001`. */
const gid = (type: string) => z.string().regex(new RegExp(`^gid://shopify/${type}/\\d+$`));

/** Shopify's `Decimal`/`Money` scalars arrive as strings, e.g. "12.50". */
const decimal = z.string().regex(/^-?\d+(\.\d+)?$/);

const isoDateTime = z.iso.datetime();

export const moneyV2Schema = z.object({
  amount: decimal,
  currencyCode: z.string().length(3),
});

/** Real bags also carry `presentmentMoney`; the simulation is single-currency. */
export const moneyBagSchema = z.object({ shopMoney: moneyV2Schema });

export const pageInfoSchema = z.object({
  hasNextPage: z.boolean(),
  endCursor: z.string().nullable(),
});

export const connectionSchema = <T extends z.ZodType>(node: T) =>
  z.object({
    edges: z.array(z.object({ cursor: z.string(), node })),
    pageInfo: pageInfoSchema,
  });

export interface ShopifyConnection<T> {
  edges: { cursor: string; node: T }[];
  pageInfo: z.infer<typeof pageInfoSchema>;
}

export const productVariantSchema = z.object({
  id: gid('ProductVariant'),
  title: z.string(),
  sku: z.string().nullable(),
  price: decimal,
  inventoryQuantity: z.number().int().nullable(),
  inventoryItem: z.object({
    // Merchant-entered cost per unit; null until the merchant fills it in.
    unitCost: moneyV2Schema.nullable(),
  }),
});

export const productSchema = z.object({
  id: gid('Product'),
  title: z.string(),
  status: z.enum(['ACTIVE', 'ARCHIVED', 'DRAFT']),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
  variants: connectionSchema(productVariantSchema),
});

export const customerSchema = z.object({
  id: gid('Customer'),
  email: z.string().nullable(),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  createdAt: isoDateTime,
});

export const lineItemSchema = z.object({
  id: gid('LineItem'),
  title: z.string(),
  sku: z.string().nullable(),
  quantity: z.number().int().positive(),
  // Price of one unit before discounts.
  originalUnitPriceSet: moneyBagSchema,
  // Discount allocated to the whole line (all units).
  totalDiscountSet: moneyBagSchema,
  // Null when the product/variant has been deleted from the shop.
  product: z.object({ id: gid('Product') }).nullable(),
  variant: z.object({ id: gid('ProductVariant') }).nullable(),
});

export const refundSchema = z.object({
  id: gid('Refund'),
  createdAt: isoDateTime,
  // Simplification: real refunds include the refunded tax; here it is the net line value only.
  totalRefundedSet: moneyBagSchema,
  refundLineItems: connectionSchema(
    z.object({
      quantity: z.number().int().positive(),
      lineItem: z.object({ id: gid('LineItem') }),
    }),
  ),
});

export const orderSchema = z.object({
  id: gid('Order'),
  name: z.string(),
  // Nullable in the real API (draft orders); the simulation always sets it.
  processedAt: isoDateTime,
  updatedAt: isoDateTime,
  displayFinancialStatus: z.enum([
    'AUTHORIZED',
    'EXPIRED',
    'PAID',
    'PARTIALLY_PAID',
    'PARTIALLY_REFUNDED',
    'PENDING',
    'REFUNDED',
    'VOIDED',
  ]),
  currencyCode: z.string().length(3),
  customer: z
    .object({
      id: gid('Customer'),
      email: z.string().nullable(),
      firstName: z.string().nullable(),
      lastName: z.string().nullable(),
    })
    .nullable(),
  // Sum of line prices after discounts, before tax.
  subtotalPriceSet: moneyBagSchema,
  totalDiscountsSet: moneyBagSchema,
  totalTaxSet: moneyBagSchema,
  totalPriceSet: moneyBagSchema,
  totalRefundedSet: moneyBagSchema,
  lineItems: connectionSchema(lineItemSchema),
  // A plain list in the real API, not a connection.
  refunds: z.array(refundSchema),
});

export type ShopifyMoneyBag = z.infer<typeof moneyBagSchema>;
export type ShopifyProductVariant = z.infer<typeof productVariantSchema>;
export type ShopifyProduct = z.infer<typeof productSchema>;
export type ShopifyCustomer = z.infer<typeof customerSchema>;
export type ShopifyLineItem = z.infer<typeof lineItemSchema>;
export type ShopifyRefund = z.infer<typeof refundSchema>;
export type ShopifyOrder = z.infer<typeof orderSchema>;
