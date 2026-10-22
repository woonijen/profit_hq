/**
 * Markdown suggestions for dead stock, kept free of the database. The longer a variant has sat
 * unsold, the deeper the discount we suggest. Definitions: docs/dead-stock.md.
 */

/** Discount per tier, deepest first: a variant gets the first tier it has been idle long enough for. */
export const MARKDOWN_TIERS = [
  { minDaysInactive: 90, discountPct: 50 },
  { minDaysInactive: 60, discountPct: 30 },
  { minDaysInactive: 30, discountPct: 15 },
] as const;

/** The discount in percent (0, 15, 30 or 50) for a variant idle for `daysInactive` days. */
export function markdownDiscountPct(daysInactive: number): number {
  return MARKDOWN_TIERS.find((tier) => daysInactive >= tier.minDaysInactive)?.discountPct ?? 0;
}

export interface MarkdownSuggestion {
  /** 0 when the variant has not been idle long enough for the first tier. */
  suggestedDiscountPct: number;
  /** The current price less the discount, rounded half up to a cent. */
  suggestedPriceCents: number;
  /** Profit per unit at the suggested price; negative below cost. Null when the cost is unknown. */
  marginAfterMarkdownCents: number | null;
  /**
   * The suggested price is under the unit cost, so each sale would lose money. Selling at
   * exactly the cost is break-even, not below it. False when the cost is unknown (the row is
   * marked "cost missing" instead, because there is nothing to compare with).
   */
  belowCost: boolean;
}

/** The markdown to suggest for a variant with the given idle time, current price and unit cost. */
export function suggestMarkdown(
  daysInactive: number,
  priceCents: number,
  unitCostCents: number | null,
): MarkdownSuggestion {
  const suggestedDiscountPct = markdownDiscountPct(daysInactive);
  // Integer maths: price × (100 − pct) ÷ 100, half up.
  const suggestedPriceCents = Math.floor((priceCents * (100 - suggestedDiscountPct) + 50) / 100);
  const marginAfterMarkdownCents =
    unitCostCents === null ? null : suggestedPriceCents - unitCostCents;

  return {
    suggestedDiscountPct,
    suggestedPriceCents,
    marginAfterMarkdownCents,
    belowCost: marginAfterMarkdownCents !== null && marginAfterMarkdownCents < 0,
  };
}
