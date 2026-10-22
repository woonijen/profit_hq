import { describe, expect, it } from 'vitest';
import { MARKDOWN_TIERS, markdownDiscountPct, suggestMarkdown } from './markdown.js';

describe('markdownDiscountPct', () => {
  it.each([
    [0, 0],
    [29, 0],
    [30, 15],
    [59, 15],
    [60, 30],
    [89, 30],
    [90, 50],
    [400, 50],
  ])('%s days idle → %s%%', (days, pct) => {
    expect(markdownDiscountPct(days)).toBe(pct);
  });

  it('matches the tiers in docs/dead-stock.md', () => {
    expect(MARKDOWN_TIERS.map((t) => [t.minDaysInactive, t.discountPct])).toEqual([
      [90, 50],
      [60, 30],
      [30, 15],
    ]);
  });
});

describe('suggestMarkdown', () => {
  it('takes the discount off the price and reports the margin that is left', () => {
    expect(suggestMarkdown(45, 2000, 1000)).toEqual({
      suggestedDiscountPct: 15,
      suggestedPriceCents: 1700,
      marginAfterMarkdownCents: 700,
      belowCost: false,
    });
    expect(suggestMarkdown(75, 2000, 1000)).toMatchObject({
      suggestedDiscountPct: 30,
      suggestedPriceCents: 1400,
      marginAfterMarkdownCents: 400,
    });
    expect(suggestMarkdown(120, 2000, 1000)).toMatchObject({
      suggestedDiscountPct: 50,
      suggestedPriceCents: 1000,
      marginAfterMarkdownCents: 0,
    });
  });

  it('rounds the suggested price half a cent up', () => {
    expect(suggestMarkdown(30, 1999, null).suggestedPriceCents).toBe(1699); // 1699.15
    expect(suggestMarkdown(30, 1990, null).suggestedPriceCents).toBe(1692); // 1691.5
    expect(suggestMarkdown(90, 1001, null).suggestedPriceCents).toBe(501); // 500.5
  });

  it('warns when the suggested price is under the unit cost', () => {
    const loss = suggestMarkdown(100, 1000, 600); // 50% off = 500, cost 600
    expect(loss).toMatchObject({ suggestedPriceCents: 500, marginAfterMarkdownCents: -100 });
    expect(loss.belowCost).toBe(true);
  });

  it('treats selling exactly at cost as break-even, not a loss', () => {
    const breakEven = suggestMarkdown(100, 1000, 500);
    expect(breakEven.marginAfterMarkdownCents).toBe(0);
    expect(breakEven.belowCost).toBe(false);
  });

  it('has no margin and no warning when the cost is unknown', () => {
    expect(suggestMarkdown(100, 1000, null)).toEqual({
      suggestedDiscountPct: 50,
      suggestedPriceCents: 500,
      marginAfterMarkdownCents: null,
      belowCost: false,
    });
  });

  it('suggests nothing before the first tier', () => {
    expect(suggestMarkdown(10, 1000, 600)).toEqual({
      suggestedDiscountPct: 0,
      suggestedPriceCents: 1000,
      marginAfterMarkdownCents: 400,
      belowCost: false,
    });
  });

  it('can warn even at the smallest discount when the margin is already negative', () => {
    expect(suggestMarkdown(30, 1000, 900).belowCost).toBe(true); // 850 < 900
    expect(suggestMarkdown(30, 1000, 850).belowCost).toBe(false); // 850 = 850
  });
});
