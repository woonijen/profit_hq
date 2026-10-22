/**
 * Holding cost of idle stock, kept free of the database. Definitions: docs/dead-stock.md.
 *
 * Money is integer cents. The rate is a fraction of stock value per month (0.02 = 2%), limited
 * to whole multiples of 0.01% so the maths can run on integers and never pick up float error.
 */

/** What a store pays to keep stock per month, as a fraction of the stock's value. */
export const DEFAULT_HOLDING_COST_RATE = 0.02;

/** 1 / RATE_SCALE is the smallest rate step: 0.0001 = 0.01%. */
const RATE_SCALE = 10_000;

/** True when `rate` is a whole number of 0.01% steps (floats like 0.07 are not exact, so allow slack). */
export function hasRatePrecision(rate: number): boolean {
  return Math.abs(rate * RATE_SCALE - Math.round(rate * RATE_SCALE)) < 1e-6;
}

/** Whether `rate` is storable: a fraction from 0 to 1 in whole 0.01% steps. */
export function isHoldingCostRate(rate: number): boolean {
  return Number.isFinite(rate) && rate >= 0 && rate <= 1 && hasRatePrecision(rate);
}

/**
 * Monthly cost of holding `quantity` units that cost `unitCostCents` each:
 * quantity × unit cost × rate, rounded half up to a whole cent.
 *
 * Returns null when the unit cost is unknown (an unknown cost is not a free one, so callers
 * leave such rows out of totals and mark them "cost missing").
 */
export function holdingCostCents(
  quantity: number,
  unitCostCents: number | null,
  rate: number,
): number | null {
  if (unitCostCents === null) return null;
  if (quantity <= 0) return 0;

  const scaled = quantity * unitCostCents * Math.round(rate * RATE_SCALE);
  const remainder = scaled % RATE_SCALE;
  const whole = (scaled - remainder) / RATE_SCALE;
  return remainder * 2 >= RATE_SCALE ? whole + 1 : whole;
}
