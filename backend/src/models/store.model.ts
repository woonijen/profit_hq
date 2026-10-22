import { type InferSchemaType, model, Schema } from 'mongoose';
import { DEFAULT_HOLDING_COST_RATE, isHoldingCostRate } from '../inventory/holding-cost.js';

/** A merchant's (simulated) Shopify shop. Every product, order and sync run belongs to one. */
const storeSchema = new Schema(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    // e.g. "demo-1a2b3c.myshopify.com". One shop can only be connected to one owner.
    shopDomain: { type: String, required: true, unique: true, lowercase: true, trim: true },
    // ISO 4217 code; all of a store's money amounts are in this currency.
    currency: { type: String, required: true, uppercase: true, match: /^[A-Z]{3}$/ },
    // IANA zone name. Day/month buckets in reports are cut in this zone, not in UTC.
    timezone: { type: String, required: true },
    // Monthly cost of holding stock as a fraction of its value (0.02 = 2%), in 0.01% steps.
    // Stores created before this field existed read as the default.
    holdingCostRate: {
      type: Number,
      default: DEFAULT_HOLDING_COST_RATE,
      validate: {
        validator: isHoldingCostRate,
        message: 'must be a fraction from 0 to 1 in steps of 0.0001',
      },
    },
  },
  { timestamps: true },
);

export type StoreDoc = InferSchemaType<typeof storeSchema>;
export const Store = model('Store', storeSchema);
