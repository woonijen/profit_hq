import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { DeadStockSort, SortDirection } from '@/features/inventory/types';
import { deadStockItem } from '@/test/dead-stock-fixtures';
import { DeadStockTable } from './DeadStockTable';

function renderTable(
  items = [deadStockItem()],
  sort: DeadStockSort = 'daysInactive',
  direction: SortDirection = 'desc',
) {
  const onSort = vi.fn();
  render(
    <DeadStockTable
      items={items}
      currency="USD"
      sort={sort}
      direction={direction}
      onSort={onSort}
    />,
  );
  return onSort;
}

describe('DeadStockTable', () => {
  it('shows a row per variant with its figures', () => {
    renderTable();

    const row = screen.getByRole('row', { name: /Canvas Tote/ });
    expect(within(row).getByText('TOTE-1')).toBeInTheDocument();
    expect(within(row).getByText('$200.00')).toBeInTheDocument(); // stock value
    expect(within(row).getByText('$4.00')).toBeInTheDocument(); // holding cost
    expect(within(row).getByText('60 days')).toBeInTheDocument();
  });

  it('hides the "Default Title" placeholder but keeps a real variant name', () => {
    renderTable([
      deadStockItem({ variantId: 'a', productTitle: 'Mug', variantTitle: 'Default Title' }),
      deadStockItem({ variantId: 'b', productTitle: 'Shirt', variantTitle: 'Large', sku: null }),
    ]);

    expect(screen.queryByText(/Default Title/)).not.toBeInTheDocument();
    expect(screen.getByText('Large')).toBeInTheDocument();
  });

  it('says "Cost missing" instead of a value when the cost is unknown', () => {
    renderTable([
      deadStockItem({ unitCostCents: null, stockValueCents: null, holdingCostCents: null }),
    ]);

    expect(screen.getAllByText('Cost missing')).toHaveLength(2);
  });

  it('says "Never" for a variant that never sold', () => {
    renderTable([deadStockItem({ lastSoldAt: null })]);

    expect(screen.getByText('Never')).toBeInTheDocument();
  });

  it('marks the sorted column with aria-sort and no other', () => {
    renderTable([deadStockItem()], 'stockValue', 'asc');

    expect(screen.getByRole('columnheader', { name: /Stock value/ })).toHaveAttribute(
      'aria-sort',
      'ascending',
    );
    expect(screen.getByRole('columnheader', { name: /Days inactive/ })).toHaveAttribute(
      'aria-sort',
      'none',
    );
  });

  it('reports the column when a sortable header is clicked', async () => {
    const onSort = renderTable();

    await userEvent.click(screen.getByRole('button', { name: /In stock/ }));

    expect(onSort).toHaveBeenCalledWith('quantity');
  });

  it('can be scrolled with the keyboard on a narrow screen', () => {
    renderTable();

    expect(screen.getByRole('region', { name: 'Dead stock table' })).toHaveAttribute(
      'tabindex',
      '0',
    );
  });
});
