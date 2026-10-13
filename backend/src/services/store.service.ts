import { Types } from 'mongoose';
import { AppError } from '../errors/app-error.js';
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
    { upsert: true, returnDocument: 'after' },
  );
}

/**
 * The owner's stores. Creates the default store first, so accounts registered before stores
 * existed get theirs the first time the client asks.
 */
export async function listOwnedStores(ownerId: string) {
  const ownerObjectId = new Types.ObjectId(ownerId);
  await ensureDefaultStore(ownerObjectId);
  return Store.find({ ownerId: ownerObjectId }).sort({ createdAt: 1 });
}

/**
 * Loads a store the caller owns. Someone else's store is reported as missing, not forbidden,
 * so ids cannot be probed.
 */
export async function getOwnedStore(storeId: string, ownerId: string) {
  const store = await Store.findOne({
    _id: new Types.ObjectId(storeId),
    ownerId: new Types.ObjectId(ownerId),
  });
  if (!store) throw AppError.notFound('Store not found');
  return store;
}
