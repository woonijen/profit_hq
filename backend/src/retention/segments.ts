/**
 * Customer segments, kept free of the database so they can be tested with plain numbers.
 * Definitions and the reasoning behind the thresholds: docs/retention.md.
 */

export const CUSTOMER_SEGMENTS = ['VIP', 'AT_RISK', 'CHURNED', 'ACTIVE'] as const;
export type CustomerSegment = (typeof CUSTOMER_SEGMENTS)[number];

/** More days than this since the last order: Churned. */
export const CHURNED_AFTER_DAYS = 60;
/** More days than this (up to CHURNED_AFTER_DAYS): At-Risk. Within it, the customer is recent. */
export const AT_RISK_AFTER_DAYS = 30;
/** A recent customer with at least this many orders is a VIP. */
export const VIP_MIN_ORDERS = 3;

/**
 * The segment of a customer from `daysSinceLastOrder` (calendar days, 0 = ordered today) and
 * their number of counted orders. The checks run in order and the first match wins, so a
 * lapsing customer is never a VIP however many orders they have.
 *
 * Boundaries: 30 days is still recent, 31 is At-Risk, 60 is still At-Risk, 61 is Churned.
 */
export function segmentFor(daysSinceLastOrder: number, orderCount: number): CustomerSegment {
  if (daysSinceLastOrder > CHURNED_AFTER_DAYS) return 'CHURNED';
  if (daysSinceLastOrder > AT_RISK_AFTER_DAYS) return 'AT_RISK';
  return orderCount >= VIP_MIN_ORDERS ? 'VIP' : 'ACTIVE';
}
