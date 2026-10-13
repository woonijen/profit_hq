import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MetricCard } from './MetricCard';

const base = { label: 'Net profit', value: '$1,000.00', comparedTo: 'previous 30 days' };

describe('MetricCard', () => {
  it('shows the label, the value and the change against the previous period', () => {
    render(<MetricCard {...base} delta={{ text: '+12.3%', direction: 'up' }} />);

    expect(screen.getByRole('heading', { name: 'Net profit' })).toBeInTheDocument();
    expect(screen.getByText('$1,000.00')).toBeInTheDocument();
    expect(screen.getByText('+12.3%')).toBeInTheDocument();
  });

  it('spells the direction out for screen readers, not just by colour or arrow', () => {
    render(<MetricCard {...base} delta={{ text: '-4.0%', direction: 'down' }} />);

    expect(screen.getByText(/down compared with the previous 30 days/)).toBeInTheDocument();
  });

  it('colours a rise as good, and a fall as bad', () => {
    const { rerender } = render(
      <MetricCard {...base} delta={{ text: '+5.0%', direction: 'up' }} />,
    );
    expect(screen.getByText('+5.0%').parentElement).toHaveClass('text-good');

    rerender(<MetricCard {...base} delta={{ text: '-5.0%', direction: 'down' }} />);
    expect(screen.getByText('-5.0%').parentElement).toHaveClass('text-bad');
  });

  it('flips the colours for a cost, where a rise is bad news', () => {
    const { rerender } = render(
      <MetricCard {...base} upIsGood={false} delta={{ text: '+5.0%', direction: 'up' }} />,
    );
    expect(screen.getByText('+5.0%').parentElement).toHaveClass('text-bad');

    rerender(
      <MetricCard {...base} upIsGood={false} delta={{ text: '-5.0%', direction: 'down' }} />,
    );
    expect(screen.getByText('-5.0%').parentElement).toHaveClass('text-good');
  });

  it('shows no good/bad colour when nothing changed', () => {
    render(<MetricCard {...base} delta={{ text: '0.0%', direction: 'flat' }} />);

    const delta = screen.getByText('0.0%').parentElement;
    expect(delta).toHaveClass('text-ink-muted');
    expect(screen.getByText(/unchanged compared with/)).toBeInTheDocument();
  });

  it('says so when there is no previous period to compare with', () => {
    render(<MetricCard {...base} delta={null} />);

    expect(screen.getByText('No data for the previous 30 days')).toBeInTheDocument();
  });

  it('can show an extra line under the value', () => {
    render(<MetricCard {...base} delta={null} detail="Net margin 62.1%" />);

    expect(screen.getByText('Net margin 62.1%')).toBeInTheDocument();
  });
});
