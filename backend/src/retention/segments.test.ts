import { describe, expect, it } from 'vitest';
import { segmentFor } from './segments.js';

describe('segmentFor', () => {
  it.each([
    // days since last order, orders, segment
    [0, 1, 'ACTIVE'],
    [0, 2, 'ACTIVE'],
    [0, 3, 'VIP'],
    [30, 2, 'ACTIVE'],
    [30, 3, 'VIP'],
    [31, 1, 'AT_RISK'],
    [31, 3, 'AT_RISK'],
    [60, 1, 'AT_RISK'],
    [60, 3, 'AT_RISK'],
    [61, 1, 'CHURNED'],
    [61, 3, 'CHURNED'],
    [365, 1, 'CHURNED'],
  ] as const)('%i days since the last order, %i orders -> %s', (days, orders, segment) => {
    expect(segmentFor(days, orders)).toBe(segment);
  });

  it('needs three orders for VIP: two is Active, three is VIP', () => {
    expect(segmentFor(10, 2)).toBe('ACTIVE');
    expect(segmentFor(10, 3)).toBe('VIP');
  });

  it('lets lapsing outrank loyalty: a ten-order customer silent for 45 days is At-Risk', () => {
    expect(segmentFor(45, 10)).toBe('AT_RISK');
    expect(segmentFor(90, 10)).toBe('CHURNED');
  });
});
