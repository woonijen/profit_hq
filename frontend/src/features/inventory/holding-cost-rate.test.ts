import { describe, expect, it } from 'vitest';
import { formatRateInput, parseRateInput } from './holding-cost-rate';

describe('formatRateInput', () => {
  it('shows the fraction as a percent without float noise', () => {
    expect(formatRateInput(0.02)).toBe('2');
    expect(formatRateInput(0.0235)).toBe('2.35');
    expect(formatRateInput(0.07)).toBe('7');
    expect(formatRateInput(0)).toBe('0');
    expect(formatRateInput(1)).toBe('100');
  });
});

describe('parseRateInput', () => {
  it.each([
    ['2', 0.02],
    ['2.5', 0.025],
    ['2,5', 0.025],
    [' 3.5% ', 0.035],
    ['0', 0],
    ['100', 1],
    ['7', 0.07],
    ['0.01', 0.0001],
  ])('turns %j into the fraction %s', (text, rate) => {
    expect(parseRateInput(text)).toEqual({ ok: true, rate });
  });

  it.each(['', 'abc', '-1', '100.01', '101', '2.555', '1e2', '2%%'])('rejects %j', (text) => {
    expect(parseRateInput(text)).toMatchObject({ ok: false });
  });

  it('round-trips with the formatter', () => {
    for (const rate of [0.0001, 0.0235, 0.02, 0.5, 1]) {
      expect(parseRateInput(formatRateInput(rate))).toEqual({ ok: true, rate });
    }
  });
});
