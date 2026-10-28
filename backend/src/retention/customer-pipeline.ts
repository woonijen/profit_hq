/**
 * The per-customer facts the CRM segments are worked out from, and the one aggregation that
 * collects them. Definitions: docs/retention.md.
 */
import type { PipelineStage, Types } from 'mongoose';
import { REVENUE_STATUSES } from '../metrics/definitions.js';
import { netRevenueCents } from '../metrics/period-sums.js';

/** A value taken from the most recent order that has one; null when no order has it. */
interface Latest {
  at: Date;
  value: string;
}

/** One row of {@link buildCustomerPipeline}. `_id: null` is the group of guest checkouts. */
export interface CustomerRow {
  _id: string | null;
  orders: number;
  lastOrderAt: Date;
  grossCents: number;
  discountCents: number;
  refundedCents: number;
  latestEmail: Latest | null;
  latestName: Latest | null;
}

/** A customer as the segmenting needs them. Money in cents. */
export interface CustomerFacts {
  /** Shopify id of the customer. */
  customerId: string;
  /** The email of the latest order that has one, else the numeric Shopify id. */
  identifier: string;
  name: string | null;
  orders: number;
  lastOrderAt: Date;
  /** Net Revenue of their counted orders (a fully refunded order adds 0). */
  lifetimeSpendCents: number;
}

/** The latest non-empty value of `field` by order date: the max of `{ at, value }` pairs. */
function latestOf(field: string) {
  return {
    $max: {
      $cond: [
        { $eq: [{ $type: `$${field}` }, 'string'] },
        { at: '$processedAt', value: `$${field}` },
        '$$REMOVE',
      ],
    },
  };
}

/**
 * One row per customer of a store, plus one for the guest checkouts (`_id: null`), in a single
 * pass over the orders that count towards revenue (same statuses as the metrics). Order money is
 * summed at order level and line items are never unwound, so nothing is multiplied by the number
 * of lines (docs/adr/0004-aggregation-design.md).
 *
 * No date bounds: a customer's spend and last order reach back as far as the data does. The
 * match uses the `(storeId, processedAt)` index by its `storeId` prefix; there is no `$sort`,
 * and the output is one small row per customer however many orders there are. A
 * `(storeId, customerShopifyId, processedAt)` index would only help if the prefix proves too
 * slow, which the cost model (every counted order of one store read once) does not suggest for
 * a store of thousands of orders.
 */
export function buildCustomerPipeline(storeId: Types.ObjectId): PipelineStage[] {
  return [
    { $match: { storeId, financialStatus: { $in: [...REVENUE_STATUSES] } } },
    {
      $group: {
        // A guest checkout has a null (or missing) id: all of them land in one group.
        _id: { $ifNull: ['$customerShopifyId', null] },
        orders: { $sum: 1 },
        lastOrderAt: { $max: '$processedAt' },
        grossCents: { $sum: '$grossCents' },
        discountCents: { $sum: '$discountCents' },
        refundedCents: { $sum: '$refundedCents' },
        latestEmail: latestOf('customerEmail'),
        latestName: latestOf('customerName'),
      },
    },
  ];
}

/** The trailing number of a Shopify id, e.g. `gid://shopify/Customer/6000001` → `6000001`. */
export function numericShopifyId(gid: string): string {
  return gid.slice(gid.lastIndexOf('/') + 1);
}

/** Splits the pipeline's rows into the customers and the number of guest-checkout orders. */
export function toCustomerFacts(rows: readonly CustomerRow[]): {
  customers: CustomerFacts[];
  guestOrders: number;
} {
  let guestOrders = 0;
  const customers: CustomerFacts[] = [];
  for (const row of rows) {
    if (row._id === null) {
      guestOrders += row.orders;
      continue;
    }
    customers.push({
      customerId: row._id,
      identifier: row.latestEmail?.value ?? numericShopifyId(row._id),
      name: row.latestName?.value ?? null,
      orders: row.orders,
      lastOrderAt: row.lastOrderAt,
      lifetimeSpendCents: netRevenueCents(row),
    });
  }
  return { customers, guestOrders };
}
