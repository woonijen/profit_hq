# Sync engine

How ProfitHQ copies a store's data from Shopify (simulated today) into MongoDB. Code lives in
`backend/src/sync/` (mapping and writing) and `backend/src/services/sync*.ts` (orchestration).

## Flow

1. `POST /api/stores/:storeId/sync` checks ownership, takes the store's lock by creating a
   `SyncRun`, and answers `202` with the run. The sync continues in the background.
2. Products are synced first, then orders (orders need product costs for the COGS snapshot).
3. Each entity is processed page by page (100 items): fetch → map → diff → bulk write → record
   progress on the run.
4. The run ends as `succeeded`, `partial` (some documents were skipped) or `failed` (aborted).
5. `GET /api/stores/:storeId/sync/latest` returns the store's most recent run, for polling.

## Idempotency invariant

> Syncing the same Shopify data any number of times leaves the database exactly as the first
> sync did: same documents, same field values, and no document rewritten after the first sync.

It holds because of three things working together:

- **Natural key.** Every product and order has a unique index on `(storeId, shopifyId)`, and
  writes are upserts on that key, so a re-sync can never create a duplicate.
- **Content hash.** Each mapped document carries a `contentHash` (SHA-256 of its canonical JSON).
  The batch loads the stored hashes with one query and skips documents whose hash matches, so
  an unchanged document is not even written (`unchanged` in the run's counts).
- **COGS snapshot.** The hash covers only Shopify-sourced fields, never the cost snapshot.
  When an existing order is rewritten, its lines keep the cost stored earlier
  (`sync/reconcile.ts`). A later change to a product cost therefore cannot change past profit.

Proven by `backend/src/services/sync.service.test.ts`: it syncs three times and compares
document counts, net revenue, COGS and the last write time. These tests need the dedicated test
database (`MONGODB_URI_TEST` in `backend/.env`) and skip themselves without it.

## One sync at a time

A unique partial index on `SyncRun(storeId)` where `status = 'running'` makes the database the
lock: a second start fails with a duplicate key, which the API reports as `409`. Each page bumps
the run's `heartbeatAt`; a running run silent for more than 5 minutes is considered crashed and
is marked `failed` by the next start attempt, which then proceeds.

## Failures and resuming

- A payload that cannot be mapped (bad money, totals that do not add up, wrong currency) is
  skipped. It is counted in `failed`, listed in the run's `failures` (first 20), and the run
  finishes as `partial`. The next sync retries it.
- Anything else (Shopify or database errors) fails the run. `error` says what and in which
  entity, and `checkpoint` keeps the cursor of the last page that was written.
- The next sync starts from that checkpoint (`resumed: true`) instead of from page one. A
  `succeeded` or `partial` run has nothing to resume, so the next sync starts fresh.
- Nested lists (variants, line items) must arrive complete; a list that claims more pages is
  rejected rather than silently truncated.

## Not covered yet

- Customers are not stored; orders keep `customerShopifyId`, `customerEmail` and `customerName` (null for guest checkouts), which the retention segments are computed from ([retention.md](retention.md)). `customerName` was added later, so the first sync after it rewrites every order once, because the content hash includes it.
- The mock shop's history window ends at the start of the current UTC day, so on a new day the
  mock orders' timestamps shift and the first sync of that day rewrites them. A real Shopify
  client has stable timestamps.
- Sync is full, not incremental (no `updated_at` filter), which is fine at mock scale.
