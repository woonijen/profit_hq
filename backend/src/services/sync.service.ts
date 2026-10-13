import type { Types } from 'mongoose';
import { logger } from '../config/logger.js';
import { Order } from '../models/order.model.js';
import { Product } from '../models/product.model.js';
import type { StoreDoc } from '../models/store.model.js';
import { getShopifyClient } from '../shopify/client-factory.js';
import type { ShopifyConnection } from '../shopify/schemas.js';
import type { PageArgs, ShopifyClient } from '../shopify/shopify-client.js';
import { upsertChanged, type UpsertResult } from '../sync/bulk-upsert.js';
import {
  type CostLookup,
  type MapContext,
  mapOrder,
  mapProduct,
  MappingError,
} from '../sync/mappers.js';
import { keepStoredCogs } from '../sync/reconcile.js';
import {
  acquireSyncRun,
  type Checkpoint,
  type Failure,
  finishRun,
  recordProgress,
  SyncSupersededError,
  toPublicRun,
} from './sync-run.service.js';

/** One page is one unit of work: fetched, mapped, written and checkpointed together. */
export const PAGE_SIZE = 100;

type SyncStore = Pick<StoreDoc, 'currency'> & { _id: Types.ObjectId };

export interface StartedSync {
  /** The run as it was created, for the 202 response. */
  run: ReturnType<typeof toPublicRun>;
  /** Settles when the sync is over, however it ended. Never rejects. */
  done: Promise<void>;
}

/**
 * Starts a sync for the store and returns as soon as the run exists (409 if one is already
 * running). The sync itself continues in the background; follow it through the run's status.
 * Pass `client` to sync from somewhere other than the store's own Shopify client (tests).
 */
export async function startSync(
  store: SyncStore,
  client: ShopifyClient = getShopifyClient(store),
): Promise<StartedSync> {
  const { run, resumeFrom } = await acquireSyncRun(store._id);
  logger.info({ storeId: store._id, runId: run._id, resumed: Boolean(resumeFrom) }, 'Sync started');

  const done = executeSync(run._id, store, client, resumeFrom).catch((err: unknown) => {
    // Only reachable if even recording the outcome failed; the stale-run check will recover it.
    logger.error({ err, runId: run._id }, 'Sync could not record its outcome');
  });
  return { run: toPublicRun(run), done };
}

async function executeSync(
  runId: Types.ObjectId,
  store: SyncStore,
  client: ShopifyClient,
  resumeFrom: Checkpoint | undefined,
): Promise<void> {
  const ctx: MapContext = { storeId: store._id, currency: store.currency };
  let entity: Checkpoint['entity'] = 'products';
  let failedDocs = 0;

  try {
    // Orders need product costs for the COGS snapshot, so products always go first.
    if (resumeFrom?.entity !== 'orders') {
      failedDocs += await syncProducts(runId, ctx, client, resumeFrom?.after ?? null);
    }
    entity = 'orders';
    const resumeOrders = resumeFrom?.entity === 'orders' ? resumeFrom.after : null;
    failedDocs += await syncOrders(runId, ctx, client, resumeOrders);

    const status = failedDocs > 0 ? 'partial' : 'succeeded';
    await finishRun(runId, { status });
    logger.info({ runId, status, failedDocs }, 'Sync finished');
  } catch (err) {
    if (err instanceof SyncSupersededError) {
      logger.warn({ runId }, 'Sync stopped: its run was taken over');
      return;
    }
    logger.error({ err, runId, entity }, 'Sync failed');
    const message = err instanceof Error ? err.message : 'Unknown error';
    await finishRun(runId, { status: 'failed', error: { message, entity } });
  }
}

function syncProducts(
  runId: Types.ObjectId,
  ctx: MapContext,
  client: ShopifyClient,
  after: string | null,
): Promise<number> {
  return syncEntity({
    runId,
    entity: 'products',
    after,
    fetchPage: (args) => client.fetchProducts(args),
    map: (node) => mapProduct(ctx, node),
    write: (docs) => upsertChanged(Product, ctx.storeId, docs),
    // Once products are done, a failed run resumes at the first page of orders.
    afterLastPage: { entity: 'orders', after: null },
  });
}

async function syncOrders(
  runId: Types.ObjectId,
  ctx: MapContext,
  client: ShopifyClient,
  after: string | null,
): Promise<number> {
  // Read from the database rather than the fetched pages, so a resumed run (which skips the
  // products phase) still sees every product's cost.
  const costs = await loadCostLookup(ctx.storeId);
  return syncEntity({
    runId,
    entity: 'orders',
    after,
    fetchPage: (args) => client.fetchOrders(args),
    map: (node) => mapOrder(ctx, node, costs),
    write: (docs) =>
      upsertChanged(Order, ctx.storeId, docs, {
        select: 'lineItems.shopifyId lineItems.unitCostCents',
        reconcile: keepStoredCogs,
      }),
  });
}

async function loadCostLookup(storeId: Types.ObjectId): Promise<CostLookup> {
  const products = await Product.find({ storeId })
    .select('variants.shopifyId variants.unitCostCents')
    .lean();
  return new Map(
    products.flatMap((product) =>
      product.variants.map(
        (variant) => [variant.shopifyId, variant.unitCostCents ?? null] as const,
      ),
    ),
  );
}

interface EntitySync<TNode extends { id: string }, TDoc> {
  runId: Types.ObjectId;
  entity: Checkpoint['entity'];
  /** Cursor to continue from; null = from the start. */
  after: string | null;
  fetchPage: (args: PageArgs) => Promise<ShopifyConnection<TNode>>;
  map: (node: TNode) => TDoc;
  write: (docs: TDoc[]) => Promise<UpsertResult>;
  /** Checkpoint to leave once the final page is written; defaults to staying on this entity. */
  afterLastPage?: Checkpoint;
}

/**
 * Pages through one entity: fetch → map → write → record progress. A payload that cannot be
 * mapped is skipped and recorded without stopping the page; anything else (fetch or database
 * errors) propagates and fails the run. Returns how many documents were skipped.
 */
async function syncEntity<TNode extends { id: string }, TDoc>(
  options: EntitySync<TNode, TDoc>,
): Promise<number> {
  const { runId, entity, fetchPage, map, write } = options;
  let after = options.after;
  let skipped = 0;

  for (;;) {
    const page = await fetchPage({ first: PAGE_SIZE, after });

    const docs: TDoc[] = [];
    const failures: Failure[] = [];
    for (const { node } of page.edges) {
      try {
        docs.push(map(node));
      } catch (err) {
        if (!(err instanceof MappingError)) throw err;
        failures.push({ shopifyId: node.id, message: err.message });
      }
    }

    const written = await write(docs);
    failures.push(...written.failures);

    const { hasNextPage, endCursor } = page.pageInfo;
    await recordProgress(runId, {
      entity,
      inserted: written.inserted,
      updated: written.updated,
      unchanged: written.unchanged,
      failures,
      checkpoint: hasNextPage
        ? { entity, after: endCursor }
        : (options.afterLastPage ?? { entity, after: endCursor }),
    });
    skipped += failures.length;

    if (!hasNextPage) return skipped;
    after = endCursor;
  }
}
