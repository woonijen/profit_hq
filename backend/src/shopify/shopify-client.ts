import type {
  ShopifyConnection,
  ShopifyCustomer,
  ShopifyOrder,
  ShopifyProduct,
} from './schemas.js';

/** Relay-style forward pagination, as in the Admin GraphQL API. */
export interface PageArgs {
  /** Page size, 1–250 (Shopify's maximum). */
  first: number;
  /** `endCursor` of the previous page; omit for the first page. */
  after?: string | null;
}

/**
 * What the sync needs from Shopify. The mock implements it today; a real Admin GraphQL client
 * can be dropped in later without touching the sync engine.
 */
export interface ShopifyClient {
  fetchProducts(args: PageArgs): Promise<ShopifyConnection<ShopifyProduct>>;
  fetchCustomers(args: PageArgs): Promise<ShopifyConnection<ShopifyCustomer>>;
  fetchOrders(args: PageArgs): Promise<ShopifyConnection<ShopifyOrder>>;
}
