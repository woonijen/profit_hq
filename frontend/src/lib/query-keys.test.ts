import { describe, expect, it } from 'vitest';
import type { CustomerSegmentsQuery } from '@/features/retention/types';
import { queryKeys } from './query-keys';

const query: CustomerSegmentsQuery = { sort: 'lifetimeSpend', direction: 'desc', page: 1 };

describe('queryKeys.customerSegments', () => {
  const key = queryKeys.customerSegments('store-1', query);

  it('sits under the store retention prefix, which a finished sync invalidates', () => {
    expect(key.slice(0, queryKeys.storeRetention('store-1').length)).toEqual(
      queryKeys.storeRetention('store-1'),
    );
  });

  it('is separate from the inventory and metrics queries of the same store', () => {
    expect(key).not.toEqual(expect.arrayContaining(['inventory']));
    expect(key).not.toEqual(expect.arrayContaining(['metrics']));
  });

  it.each([
    ['segment', { ...query, segment: 'VIP' as const }],
    ['sort', { ...query, sort: 'orders' as const }],
    ['direction', { ...query, direction: 'asc' as const }],
    ['page', { ...query, page: 2 }],
  ])('differs when the %s differs, so each view is cached on its own', (_name, other) => {
    expect(queryKeys.customerSegments('store-1', other)).not.toEqual(key);
  });

  it('differs between stores', () => {
    expect(queryKeys.customerSegments('store-2', query)).not.toEqual(key);
  });
});
