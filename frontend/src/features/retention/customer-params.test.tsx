import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter, useLocation } from 'react-router';
import { describe, expect, it } from 'vitest';
import { useCustomerParams } from './customer-params';

function renderParams(initialUrl: string) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[initialUrl]}>{children}</MemoryRouter>
  );
  return renderHook(() => ({ params: useCustomerParams(), location: useLocation() }), {
    wrapper,
  });
}

/** The query string the hook left in the URL, as an object. */
const search = (location: { search: string }) =>
  Object.fromEntries(new URLSearchParams(location.search));

describe('useCustomerParams', () => {
  it('reads the view from the URL', () => {
    const { result } = renderParams('/customers?segment=AT_RISK&sort=orders&dir=asc&page=3');

    expect(result.current.params.query).toEqual({
      segment: 'AT_RISK',
      sort: 'orders',
      direction: 'asc',
      page: 3,
    });
  });

  it('lists every customer by lifetime spend, highest first, without parameters', () => {
    const { result } = renderParams('/customers');

    expect(result.current.params.query).toEqual({
      segment: undefined,
      sort: 'lifetimeSpend',
      direction: 'desc',
      page: 1,
    });
  });

  it('falls back to the defaults for an unknown value', () => {
    const { result } = renderParams('/customers?segment=GOLD&sort=name&dir=sideways&page=0');

    expect(result.current.params.query).toEqual({
      segment: undefined,
      sort: 'lifetimeSpend',
      direction: 'desc',
      page: 1,
    });
  });

  it('rejects a segment in the wrong case and a page that is not a whole number', () => {
    expect(renderParams('/x?segment=vip').result.current.params.query.segment).toBeUndefined();
    expect(renderParams('/x?page=2.5').result.current.params.query.page).toBe(1);
    expect(renderParams('/x?page=abc').result.current.params.query.page).toBe(1);
  });

  it('writes the segment to the URL and goes back to the first page', () => {
    const { result } = renderParams('/customers?page=4');

    act(() => result.current.params.setSegment('VIP'));

    expect(search(result.current.location)).toMatchObject({ segment: 'VIP', page: '1' });
    expect(result.current.params.query.segment).toBe('VIP');
  });

  it('removes the segment from the URL when every customer is shown again', () => {
    const { result } = renderParams('/customers?segment=VIP&sort=orders');

    act(() => result.current.params.setSegment(undefined));

    expect(search(result.current.location)).toEqual({ sort: 'orders', page: '1' });
    expect(result.current.params.query.segment).toBeUndefined();
  });

  it('starts a new sort column descending, and flips the direction of the current one', () => {
    const { result } = renderParams('/customers?sort=lifetimeSpend&dir=desc&page=2');

    act(() => result.current.params.setSort('lastOrder'));
    expect(search(result.current.location)).toMatchObject({
      sort: 'lastOrder',
      dir: 'desc',
      page: '1',
    });

    act(() => result.current.params.setSort('lastOrder'));
    expect(search(result.current.location)).toMatchObject({ sort: 'lastOrder', dir: 'asc' });

    act(() => result.current.params.setSort('lastOrder'));
    expect(search(result.current.location)).toMatchObject({ sort: 'lastOrder', dir: 'desc' });
  });

  it('changes only the page, keeping the rest of the view', () => {
    const { result } = renderParams('/customers?segment=CHURNED&sort=orders&dir=asc');

    act(() => result.current.params.setPage(2));

    expect(search(result.current.location)).toEqual({
      segment: 'CHURNED',
      sort: 'orders',
      dir: 'asc',
      page: '2',
    });
  });
});
