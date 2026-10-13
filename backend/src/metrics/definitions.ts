import type { FINANCIAL_STATUSES } from '../models/order.model.js';

/**
 * Orders in these statuses count towards revenue, COGS and profit; every other status (voided,
 * pending, expired, authorized, partially paid) is ignored. See docs/metrics.md.
 */
export const REVENUE_STATUSES = [
  'PAID',
  'PARTIALLY_REFUNDED',
  'REFUNDED',
] as const satisfies readonly (typeof FINANCIAL_STATUSES)[number][];
