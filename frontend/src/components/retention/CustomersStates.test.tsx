import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CUSTOMER_SEGMENTS } from '@/features/retention/types';
import { NoCustomersInSegment, NoCustomersYet } from './CustomersEmptyState';
import { SegmentBadge } from './SegmentBadge';

describe('NoCustomersYet', () => {
  it('explains that customers come from synced orders', () => {
    render(<NoCustomersYet guestOrders={0} />);

    expect(screen.getByText('No customers yet')).toBeInTheDocument();
    expect(screen.queryByText(/guest checkout/)).not.toBeInTheDocument();
  });

  it('says how many orders are guest checkouts, with the right grammar', () => {
    const { rerender } = render(<NoCustomersYet guestOrders={1} />);
    expect(screen.getByText(/1 order was placed as a guest checkout/)).toBeInTheDocument();

    rerender(<NoCustomersYet guestOrders={154} />);
    expect(screen.getByText(/154 orders were placed as a guest checkout/)).toBeInTheDocument();
  });
});

describe('NoCustomersInSegment', () => {
  it('names the segment and says how to show everyone again', () => {
    render(<NoCustomersInSegment segment="AT_RISK" />);

    expect(screen.getByText('No At-Risk customers right now')).toBeInTheDocument();
    expect(screen.getByText(/Select the segment again/)).toBeInTheDocument();
  });
});

describe('SegmentBadge', () => {
  it.each([
    ['VIP', 'VIP'],
    ['AT_RISK', 'At-Risk'],
    ['CHURNED', 'Churned'],
    ['ACTIVE', 'Active'],
  ] as const)('shows %s as the word "%s" next to a decorative icon', (segment, label) => {
    const { container } = render(<SegmentBadge segment={segment} />);

    expect(screen.getByText(label)).toBeInTheDocument();
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('gives every segment its own colors', () => {
    const classes = CUSTOMER_SEGMENTS.map((segment) => {
      const { container } = render(<SegmentBadge segment={segment} />);
      return container.firstElementChild?.className;
    });

    expect(new Set(classes).size).toBe(CUSTOMER_SEGMENTS.length);
  });
});
