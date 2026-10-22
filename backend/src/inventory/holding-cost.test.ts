import { describe, expect, it } from 'vitest';
import {
  DEFAULT_HOLDING_COST_RATE,
  hasRatePrecision,
  holdingCostCents,
  isHoldingCostRate,
} from './holding-cost.js';

describe('holdingCostCents', () => {
  it('is quantity × unit cost × rate', () => {
    expect(holdingCostCents(10, 500, 0.02)).toBe(100); // 5000 × 2%
    expect(holdingCostCents(3, 1000, 0.07)).toBe(210); // 3000 × 7%
  });

  it('uses 2% a month by default', () => {
    expect(DEFAULT_HOLDING_COST_RATE).toBe(0.02);
    expect(holdingCostCents(1, 10_000, DEFAULT_HOLDING_COST_RATE)).toBe(200);
  });

  it('rounds half a cent up, and below half down', () => {
    expect(holdingCostCents(1, 24, 0.02)).toBe(0); // 0.48
    expect(holdingCostCents(1, 25, 0.02)).toBe(1); // 0.50
    expect(holdingCostCents(1, 74, 0.02)).toBe(1); // 1.48
    expect(holdingCostCents(1, 75, 0.02)).toBe(2); // 1.50
  });

  it('does not drift on rates that floats cannot hold exactly', () => {
    // 0.0145 is 14.5 cents per 1000 of value; floats would land a hair under or over the half.
    expect(holdingCostCents(1000, 1, 0.0145)).toBe(15);
    expect(holdingCostCents(1, 1_000_000, 0.0001)).toBe(100);
    expect(holdingCostCents(7, 1_000, 0.0003)).toBe(2); // 2.1
  });

  it('is unknown (null) when the unit cost is unknown, but 0 for a known zero cost', () => {
    expect(holdingCostCents(10, null, 0.02)).toBeNull();
    expect(holdingCostCents(10, 0, 0.02)).toBe(0);
  });

  it('costs nothing to hold no stock', () => {
    expect(holdingCostCents(0, 500, 0.02)).toBe(0);
    expect(holdingCostCents(-3, 500, 0.02)).toBe(0);
  });

  it('handles the ends of the rate range', () => {
    expect(holdingCostCents(10, 500, 0)).toBe(0);
    expect(holdingCostCents(10, 500, 1)).toBe(5000); // the whole stock value per month
  });

  it('stays exact on large stock values', () => {
    // 100 000 units × $10 000 = $1 billion of stock, at 99.99%.
    expect(holdingCostCents(100_000, 1_000_000, 0.9999)).toBe(99_990_000_000);
  });
});

describe('isHoldingCostRate', () => {
  it.each([0, 1, 0.02, 0.0001, 0.0725, 0.07])('accepts %s', (rate) => {
    expect(isHoldingCostRate(rate)).toBe(true);
  });

  it.each([-0.01, 1.01, Number.NaN, Number.POSITIVE_INFINITY, 0.00001, 0.12345])(
    'rejects %s',
    (rate) => {
      expect(isHoldingCostRate(rate)).toBe(false);
    },
  );

  it('checks the precision on its own', () => {
    expect(hasRatePrecision(0.0123)).toBe(true);
    expect(hasRatePrecision(0.01234)).toBe(false);
  });
});
