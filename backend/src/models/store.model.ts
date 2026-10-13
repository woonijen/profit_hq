import { type InferSchemaType, model, Schema } from 'mongoose';

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
  },
  { timestamps: true },
);

export type StoreDoc = InferSchemaType<typeof storeSchema>;
export const Store = model('Store', storeSchema);
