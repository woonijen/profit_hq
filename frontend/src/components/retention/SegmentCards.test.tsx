import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { CustomerSegment, SegmentSummary } from '@/features/retention/types';
import { SegmentCards } from './SegmentCards';

const segments: Record<CustomerSegment, SegmentSummary> = {
  VIP: { customers: 12, lifetimeSpendCents: 600000, shareOfRevenue: 0.5, averageSpendCents: 50000 },
  AT_RISK: {
    customers: 1,
    lifetimeSpendCents: 9000,
    shareOfRevenue: 0.075,
    averageSpendCents: 9000,
  },
  CHURNED: { customers: 0, lifetimeSpendCents: 0, shareOfRevenue: 0, averageSpendCents: 0 },
  ACTIVE: { customers: 3, lifetimeSpendCents: 0, shareOfRevenue: null, averageSpendCents: 0 },
};

function renderCards(selected?: CustomerSegment) {
  const onSelect = vi.fn();
  render(
    <SegmentCards segments={segments} currency="USD" selected={selected} onSelect={onSelect} />,
  );
  return onSelect;
}

describe('SegmentCards', () => {
  it('shows each segment with its customers, share of revenue and average spend', () => {
    renderCards();

    const vip = screen.getByRole('button', { name: /VIP/ });
    expect(vip).toHaveTextContent('12 customers');
    expect(vip).toHaveTextContent('50.0% of revenue');
    expect(vip).toHaveTextContent('$500.00 average spend');
    expect(screen.getByRole('button', { name: /At-Risk/ })).toHaveTextContent('1 customer');
  });

  it('says so when a segment is empty or has no revenue, instead of showing zeros', () => {
    renderCards();

    expect(screen.getByRole('button', { name: /Churned/ })).toHaveTextContent('No spend yet');
    expect(screen.getByRole('button', { name: /Active/ })).toHaveTextContent('No revenue');
  });

  it('marks only the selected segment as pressed', () => {
    renderCards('AT_RISK');

    expect(screen.getByRole('button', { name: /At-Risk/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /VIP/ })).toHaveAttribute('aria-pressed', 'false');
  });

  it('filters by a segment on click and clears the filter when it is pressed again', async () => {
    const user = userEvent.setup();
    const onSelect = renderCards();
    await user.click(screen.getByRole('button', { name: /VIP/ }));
    expect(onSelect).toHaveBeenLastCalledWith('VIP');

    const onSelectAgain = renderCards('VIP');
    await user.click(screen.getAllByRole('button', { name: /VIP/ })[1]!);
    expect(onSelectAgain).toHaveBeenLastCalledWith(undefined);
  });

  it('can be used from the keyboard', async () => {
    const user = userEvent.setup();
    const onSelect = renderCards();

    await user.tab();
    await user.keyboard('{Enter}');
    expect(onSelect).toHaveBeenLastCalledWith('VIP');
    await user.tab();
    await user.keyboard(' ');
    expect(onSelect).toHaveBeenLastCalledWith('AT_RISK');
  });
});
