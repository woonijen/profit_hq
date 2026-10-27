import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter, useLocation } from 'react-router';
import { describe, expect, it } from 'vitest';
import { useDeadStockParams } from './dead-stock-params';

function renderParams(initialUrl: string) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[initialUrl]}>{children}</MemoryRouter>
  );
  return renderHook(() => ({ params: useDeadStockParams(), location: useLocation() }), {
    wrapper,
  });
}

/** The query string the hook left in the URL, as an object. */
const search = (location: { search: string }) =>
  Object.fromEntries(new URLSearchParams(location.search));

describe('useDeadStockParams', () => {
  it('reads the view from the URL', () => {
    const { result } = renderParams('/dead-stock?window=60&sort=stockValue&dir=asc&page=3');

    expect(result.current.params.query).toEqual({
      window: 60,
      sort: 'stockValue',
      direction: 'asc',
      page: 3,
    });
  });

  it('falls back to the defaults for a missing or unknown value', () => {
    const { result } = renderParams('/dead-stock?window=45&sort=price&dir=sideways&page=0');

    expect(result.current.params.query).toEqual({
      window: 30,
      sort: 'daysInactive',
      direction: 'desc',
      page: 1,
    });
  });

  it('rejects a page that is not a whole number', () => {
    expect(renderParams('/x?page=2.5').result.current.params.query.page).toBe(1);
    expect(renderParams('/x?page=abc').result.current.params.query.page).toBe(1);
  });

  it('writes the window to the URL and goes back to the first page', () => {
    const { result } = renderParams('/dead-stock?page=4');

    act(() => result.current.params.setWindow(90));

    expect(search(result.current.location)).toMatchObject({ window: '90', page: '1' });
    expect(result.current.params.query.window).toBe(90);
  });

  it('starts a new sort column descending, and flips the direction of the current one', () => {
    const { result } = renderParams('/dead-stock?sort=daysInactive&dir=desc&page=2');

    act(() => result.current.params.setSort('quantity'));
    expect(search(result.current.location)).toMatchObject({
      sort: 'quantity',
      dir: 'desc',
      page: '1',
    });

    act(() => result.current.params.setSort('quantity'));
    expect(search(result.current.location)).toMatchObject({ sort: 'quantity', dir: 'asc' });

    act(() => result.current.params.setSort('quantity'));
    expect(search(result.current.location)).toMatchObject({ sort: 'quantity', dir: 'desc' });
  });

  it('changes only the page, keeping the rest of the view', () => {
    const { result } = renderParams('/dead-stock?window=60&sort=stockValue&dir=asc');

    act(() => result.current.params.setPage(2));

    expect(search(result.current.location)).toEqual({
      window: '60',
      sort: 'stockValue',
      dir: 'asc',
      page: '2',
    });
  });
});
