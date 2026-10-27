import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DeadStockEmptyState } from './DeadStockEmptyState';
import { DeadStockSummary } from './DeadStockSummary';
import { Pagination } from './Pagination';

describe('DeadStockEmptyState', () => {
  it('celebrates, and names the window', () => {
    render(<DeadStockEmptyState window={60} />);

    expect(screen.getByText('No dead stock, nice')).toBeInTheDocument();
    expect(screen.getByText(/last 60 days/)).toBeInTheDocument();
  });
});

describe('DeadStockSummary', () => {
  const totals = {
    variants: 12,
    units: 1500,
    stockValueCents: 123_456,
    monthlyHoldingCostCents: 2469,
    variantsMissingCost: 0,
  };

  it('shows the four headline numbers', () => {
    render(<DeadStockSummary totals={totals} currency="USD" />);

    expect(screen.getByRole('heading', { name: 'Dead SKUs' }).nextElementSibling).toHaveTextContent(
      '12',
    );
    expect(screen.getByText('1,500')).toBeInTheDocument();
    expect(screen.getByText('$1,234.56')).toBeInTheDocument();
    expect(screen.getByText('$24.69')).toBeInTheDocument();
    expect(screen.queryByText(/not counted/)).not.toBeInTheDocument();
  });

  it('says how many variants without a cost are left out of the money totals', () => {
    render(<DeadStockSummary totals={{ ...totals, variantsMissingCost: 3 }} currency="USD" />);

    expect(screen.getAllByText('3 without a cost not counted')).toHaveLength(2);
  });
});

describe('Pagination', () => {
  it('renders nothing for a single page', () => {
    const { container } = render(<Pagination page={1} totalPages={1} onChange={vi.fn()} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('disables Previous on the first page and Next on the last', () => {
    const { rerender } = render(<Pagination page={1} totalPages={3} onChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled();

    rerender(<Pagination page={3} totalPages={3} onChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
  });

  it('moves one page at a time and announces the position', async () => {
    const onChange = vi.fn();
    render(<Pagination page={2} totalPages={3} onChange={onChange} />);

    expect(screen.getByText('Page 2 of 3')).toHaveAttribute('aria-live', 'polite');

    await userEvent.click(screen.getByRole('button', { name: 'Previous' }));
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));

    expect(onChange).toHaveBeenNthCalledWith(1, 1);
    expect(onChange).toHaveBeenNthCalledWith(2, 3);
  });
});
