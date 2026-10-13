import { type InferSchemaType, model, Schema } from 'mongoose';
import { cents } from './fields.js';

export const PRODUCT_STATUSES = ['ACTIVE', 'ARCHIVED', 'DRAFT'] as const;

const variantSchema = new Schema(
  {
    shopifyId: { type: String, required: true },
    title: { type: String, required: true },
    sku: { type: String, default: null },
    priceCents: cents(),
    // Merchant-entered cost per unit. null = never entered, which is not the same as free.
    // The sync snapshots this onto each order line, so editing it never rewrites past profit.
    unitCostCents: cents({ nullable: true }),
    // Kept for the later Dead Stock feature.
    inventoryQuantity: { type: Number, default: 0 },
  },
  { _id: false },
);

const productSchema = new Schema(
  {
    storeId: { type: Schema.Types.ObjectId, ref: 'Store', required: true },
    shopifyId: { type: String, required: true },
    title: { type: String, required: true },
    status: { type: String, required: true, enum: PRODUCT_STATUSES },
    variants: { type: [variantSchema], default: [] },
    shopifyUpdatedAt: { type: Date, required: true },
    // Hash of the mapped fields; lets the sync skip rewriting documents that did not change.
    contentHash: { type: String, required: true },
  },
  { timestamps: true },
);

// Makes sync upserts idempotent: re-syncing the same product can never create a duplicate.
productSchema.index({ storeId: 1, shopifyId: 1 }, { unique: true });

export type ProductDoc = InferSchemaType<typeof productSchema>;
export const Product = model('Product', productSchema);
