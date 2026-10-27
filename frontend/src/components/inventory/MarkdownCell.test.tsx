import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { deadStockItem } from '@/test/dead-stock-fixtures';
import { MarkdownCell } from './MarkdownCell';

describe('MarkdownCell', () => {
  it('shows the discount, the new price and the old price', () => {
    render(<MarkdownCell item={deadStockItem()} currency="USD" />);

    expect(screen.getByText(/−30%/)).toBeInTheDocument();
    expect(screen.getByText('$35.00')).toBeInTheDocument();
    expect(screen.getByText('$50.00')).toHaveClass('line-through');
  });

  it('names the badge and the old price for screen readers', () => {
    render(<MarkdownCell item={deadStockItem()} currency="USD" />);

    expect(screen.getByText('Discount')).toHaveClass('sr-only');
    expect(screen.getByText('Current price')).toHaveClass('sr-only');
  });

  it.each([
    [15, 4250],
    [30, 3500],
    [50, 2500],
  ])('shows the %i%% tier', (pct, suggestedPriceCents) => {
    render(
      <MarkdownCell
        item={deadStockItem({ suggestedDiscountPct: pct, suggestedPriceCents })}
        currency="USD"
      />,
    );

    expect(screen.getByText(new RegExp(`−${pct}%`))).toBeInTheDocument();
  });

  it('shows no warning when the new price is above cost', () => {
    render(<MarkdownCell item={deadStockItem()} currency="USD" />);

    expect(screen.queryByText(/Below cost/)).not.toBeInTheDocument();
  });

  it('warns in words, with the loss per unit, when the new price is below cost', () => {
    render(
      <MarkdownCell
        item={deadStockItem({
          suggestedDiscountPct: 50,
          suggestedPriceCents: 2500,
          unitCostCents: 3000,
          marginAfterMarkdownCents: -500,
          belowCost: true,
        })}
        currency="USD"
      />,
    );

    expect(screen.getByText(/Below cost: loses \$5\.00 per unit/)).toBeInTheDocument();
  });

  it('shows no warning when the cost is unknown', () => {
    render(
      <MarkdownCell
        item={deadStockItem({
          unitCostCents: null,
          marginAfterMarkdownCents: null,
          belowCost: false,
        })}
        currency="USD"
      />,
    );

    expect(screen.queryByText(/Below cost/)).not.toBeInTheDocument();
  });

  it('says "None" when there is no discount to suggest', () => {
    render(
      <MarkdownCell
        item={deadStockItem({ suggestedDiscountPct: 0, suggestedPriceCents: 5000 })}
        currency="USD"
      />,
    );

    expect(screen.getByText('None')).toBeInTheDocument();
  });
});
