import type { Types } from 'mongoose';
import { Order } from '../models/order.model.js';
import type { StoreDoc } from '../models/store.model.js';
import {
  buildCustomerPipeline,
  type CustomerRow,
  toCustomerFacts,
} from '../retention/customer-pipeline.js';
import {
  buildCustomerSegmentsReport,
  type CustomerSegmentsQuery,
  type CustomerSegmentsReport,
} from '../retention/customer-report.js';

type RetentionStore = Pick<StoreDoc, 'timezone'> & { _id: Types.ObjectId };

/** Every customer of a store with their segment, summarised, filtered, sorted and paged. */
export async function getCustomerSegments(
  store: RetentionStore,
  query: CustomerSegmentsQuery,
  now = new Date(),
): Promise<CustomerSegmentsReport> {
  const rows = await Order.aggregate<CustomerRow>(buildCustomerPipeline(store._id));
  const { customers, guestOrders } = toCustomerFacts(rows);
  return buildCustomerSegmentsReport(customers, guestOrders, query, store.timezone, now);
}
