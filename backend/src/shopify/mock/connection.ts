import type { PageArgs } from '../shopify-client.js';
import type { ShopifyConnection } from '../schemas.js';

const MAX_PAGE_SIZE = 250;

/** Cursors are opaque to callers, as in Shopify; here they encode the item's list index. */
function encodeCursor(index: number): string {
  return Buffer.from(`idx:${index}`).toString('base64url');
}

function decodeCursor(cursor: string): number {
  const match = /^idx:(\d+)$/.exec(Buffer.from(cursor, 'base64url').toString());
  if (!match?.[1]) throw new Error(`Invalid cursor: ${cursor}`);
  return Number(match[1]);
}

/** Wraps a short nested list (variants, line items) as a connection with a single page. */
export function singlePage<T>(nodes: readonly T[]): ShopifyConnection<T> {
  const edges = nodes.map((node, index) => ({ cursor: encodeCursor(index), node }));
  return { edges, pageInfo: { hasNextPage: false, endCursor: edges.at(-1)?.cursor ?? null } };
}

/** Serves one page of `items` the way a cursor-paginated Shopify query would. */
export function paginate<T>(items: readonly T[], { first, after }: PageArgs): ShopifyConnection<T> {
  if (!Number.isInteger(first) || first < 1 || first > MAX_PAGE_SIZE) {
    throw new RangeError(`"first" must be an integer between 1 and ${MAX_PAGE_SIZE}`);
  }
  const start = after ? decodeCursor(after) + 1 : 0;
  const edges = items
    .slice(start, start + first)
    .map((node, offset) => ({ cursor: encodeCursor(start + offset), node }));
  return {
    edges,
    pageInfo: {
      hasNextPage: start + edges.length < items.length,
      endCursor: edges.at(-1)?.cursor ?? null,
    },
  };
}
