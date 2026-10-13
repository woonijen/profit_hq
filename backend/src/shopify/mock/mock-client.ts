import type { PageArgs, ShopifyClient } from '../shopify-client.js';
import { paginate } from './connection.js';
import { generateMockShop, type MockShopData, type MockShopOptions } from './generator.js';

/** In-memory `ShopifyClient` that serves a generated dataset through cursor pagination. */
export class MockShopifyClient implements ShopifyClient {
  private readonly data: MockShopData;

  constructor(data: MockShopData) {
    this.data = data;
  }

  fetchProducts(args: PageArgs) {
    return Promise.resolve(paginate(this.data.products, args));
  }

  fetchCustomers(args: PageArgs) {
    return Promise.resolve(paginate(this.data.customers, args));
  }

  fetchOrders(args: PageArgs) {
    return Promise.resolve(paginate(this.data.orders, args));
  }
}

export function createMockShopifyClient(options: MockShopOptions): ShopifyClient {
  return new MockShopifyClient(generateMockShop(options));
}
