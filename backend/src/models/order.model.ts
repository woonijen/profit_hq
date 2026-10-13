import { type InferSchemaType, model, Schema } from 'mongoose';
import { cents } from './fields.js';

// Mirrors Shopify's OrderDisplayFinancialStatus.
export const FINANCIAL_STATUSES = [
  'AUTHORIZED',
  'EXPIRED',
  'PAID',
  'PARTIALLY_PAID',
  'PARTIALLY_REFUNDED',
  'PENDING',
  'REFUNDED',
  'VOIDED',
] as const;

const lineItemSchema = new Schema(
  {
    shopifyId: { type: String, required: true },
    // Null when the product or variant was deleted from the shop after the order.
    productShopifyId: { type: String, default: null },
    variantShopifyId: { type: String, default: null },
    title: { type: String, required: true },
    sku: { type: String, default: null },
    quantity: { type: Number, required: true, min: 1, validate: Number.isInteger },
    unitPriceCents: cents(),
    // Total discount allocated to this line (all units), not per unit.
    discountCents: cents(),
    // COGS snapshot per unit, copied from the variant's cost when the order is synced.
    // null = cost unknown at sync time.
    unitCostCents: cents({ nullable: true }),
  },
  { _id: false },
);

const refundLineItemSchema = new Schema(
  {
    lineItemShopifyId: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1, validate: Number.isInteger },
  },
  { _id: false },
);

const refundSchema = new Schema(
  {
    shopifyId: { type: String, required: true },
    processedAt: { type: Date, required: true },
    // Excludes tax, like the order-level `refundedCents`.
    amountCents: cents(),
    lineItems: { type: [refundLineItemSchema], default: [] },
  },
  { _id: false },
);

const orderSchema = new Schema(
  {
    storeId: { type: Schema.Types.ObjectId, ref: 'Store', required: true },
    shopifyId: { type: String, required: true },
    name: { type: String, required: true }, // human order number, e.g. "#1001"
    processedAt: { type: Date, required: true },
    financialStatus: { type: String, required: true, enum: FINANCIAL_STATUSES },
    currency: { type: String, required: true, uppercase: true },

    // Order-level money, all in cents. Revenue is the sum of the lines before discounts, so
    // netRevenue = grossCents - discountCents - refundedCents. Tax is tracked separately and
    // never counts as revenue.
    grossCents: cents(),
    discountCents: cents(),
    taxCents: cents(),
    refundedCents: cents(),

    lineItems: { type: [lineItemSchema], default: [] },
    refunds: { type: [refundSchema], default: [] },

    // Customer fields are captured now for the later Dead Stock / Retention work.
    // Null for guest checkouts.
    customerShopifyId: { type: String, default: null },
    customerEmail: { type: String, default: null },

    shopifyUpdatedAt: { type: Date, required: true },
    // Hash of the mapped fields; lets the sync skip rewriting documents that did not change.
    contentHash: { type: String, required: true },
  },
  { timestamps: true },
);

// Makes sync upserts idempotent: re-syncing the same order can never create a duplicate.
orderSchema.index({ storeId: 1, shopifyId: 1 }, { unique: true });
// Serves the dashboard's date-range queries.
orderSchema.index({ storeId: 1, processedAt: 1 });

export type OrderDoc = InferSchemaType<typeof orderSchema>;
export const Order = model('Order', orderSchema);
