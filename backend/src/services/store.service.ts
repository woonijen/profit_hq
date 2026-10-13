import type { Types } from 'mongoose';
import { Store } from '../models/store.model.js';

const DEFAULT_CURRENCY = 'USD';
const DEFAULT_TIMEZONE = 'UTC';

/**
 * Returns the owner's store, creating a simulated one if they have none yet.
 * Idempotent: the shop domain is derived from the owner id, so concurrent calls resolve to the
 * same document (the unique index on `shopDomain` makes the upsert atomic).
 */
export async function ensureDefaultStore(ownerId: Types.ObjectId) {
  const shopDomain = `demo-${ownerId.toHexString().slice(-8)}.myshopify.com`;
  return Store.findOneAndUpdate(
    { shopDomain },
    { $setOnInsert: { ownerId, currency: DEFAULT_CURRENCY, timezone: DEFAULT_TIMEZONE } },
    { upsert: true, new: true },
  );
}
