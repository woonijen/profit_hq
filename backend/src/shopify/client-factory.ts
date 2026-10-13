import type { Types } from 'mongoose';
import { createMockShopifyClient } from './mock/mock-client.js';
import type { ShopifyClient } from './shopify-client.js';

const DAY_MS = 86_400_000;
const MOCK_HISTORY_DAYS = 90;

/**
 * The Shopify client for a store. Always the mock today; this is the single place to switch to
 * a real Admin GraphQL client once a store has real credentials.
 *
 * The mock's data is seeded from the store id, so a store always sees the same shop. The history
 * window ends at the start of the current UTC day: syncs on the same day fetch identical data,
 * and the window slides forward when the day changes.
 */
export function getShopifyClient(store: { _id: Types.ObjectId }): ShopifyClient {
  const seed = Number.parseInt(store._id.toHexString().slice(-8), 16);
  const endDate = new Date(Math.floor(Date.now() / DAY_MS) * DAY_MS);
  return createMockShopifyClient({ seed, days: MOCK_HISTORY_DAYS, endDate });
}
