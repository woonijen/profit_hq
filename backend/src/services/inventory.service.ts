import type { Types } from 'mongoose';
import {
  buildDeadStockReport,
  type DeadStockQuery,
  type DeadStockReport,
  type StockedProduct,
} from '../inventory/dead-stock.js';
import { buildLastSoldPipeline, type LastSoldRow } from '../inventory/last-sold-pipeline.js';
import { Order } from '../models/order.model.js';
import { Product } from '../models/product.model.js';
import type { StoreDoc } from '../models/store.model.js';

type InventoryStore = Pick<StoreDoc, 'timezone' | 'holdingCostRate'> & { _id: Types.ObjectId };

/** In-stock variants of a store that did not sell in the last `query.window` days. */
export async function getDeadStock(
  store: InventoryStore,
  query: DeadStockQuery,
  now = new Date(),
): Promise<DeadStockReport> {
  const [products, soldRows] = await Promise.all([
    Product.find({
      storeId: store._id,
      status: 'ACTIVE',
      'variants.inventoryQuantity': { $gt: 0 },
    })
      .select('shopifyId title variants createdAt shopifyCreatedAt')
      .lean(),
    Order.aggregate<LastSoldRow>(buildLastSoldPipeline(store._id)),
  ]);

  const stocked = products.map((product): StockedProduct => ({
    shopifyId: product.shopifyId,
    title: product.title,
    // Products stored before this field existed fall back to when we first saw them.
    createdAt: product.shopifyCreatedAt ?? product.createdAt,
    variants: product.variants.map((variant) => ({
      shopifyId: variant.shopifyId,
      title: variant.title,
      sku: variant.sku ?? null,
      priceCents: variant.priceCents,
      unitCostCents: variant.unitCostCents,
      inventoryQuantity: variant.inventoryQuantity,
    })),
  }));
  const lastSoldAt = new Map(soldRows.map((row) => [row._id, row.lastSoldAt]));

  return buildDeadStockReport(
    stocked,
    lastSoldAt,
    query,
    store.timezone,
    now,
    store.holdingCostRate,
  );
}
