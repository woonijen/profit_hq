import { describe, expect, it } from 'vitest';
import { customerSegmentsQuery } from './retention.schemas.js';

describe('customerSegmentsQuery', () => {
  it('defaults to every customer, by lifetime spend, highest first, 25 per page', () => {
    expect(customerSegmentsQuery.parse({})).toEqual({
      sort: 'lifetimeSpend',
      direction: 'desc',
      page: 1,
      pageSize: 25,
    });
  });

  it('accepts a segment, a sort and paging from the query string', () => {
    expect(
      customerSegmentsQuery.parse({
        segment: 'AT_RISK',
        sort: 'lastOrder',
        direction: 'asc',
        page: '2',
        pageSize: '50',
      }),
    ).toEqual({ segment: 'AT_RISK', sort: 'lastOrder', direction: 'asc', page: 2, pageSize: 50 });
  });

  it.each([
    { segment: 'vip' },
    { segment: 'GOLD' },
    { sort: 'name' },
    { direction: 'up' },
    { page: '0' },
    { pageSize: '101' },
    { pageSize: '1.5' },
  ])('rejects %o', (query) => {
    expect(customerSegmentsQuery.safeParse(query).success).toBe(false);
  });
});
