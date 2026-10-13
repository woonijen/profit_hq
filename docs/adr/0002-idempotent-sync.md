# 0002. Idempotent sync: natural keys, upserts and a content hash

Status: Accepted (Phase 3). Details: [docs/sync.md](../sync.md)

## Context

Revenue and profit are summed from synced orders, so a sync that creates a duplicate or loses
an update corrupts every number on the dashboard. Syncs will be repeated: by hand, after
failures, resumed halfway, and eventually driven by webhooks that can deliver the same event
twice. Retrying must always be safe.

## Decision

The invariant: **syncing the same Shopify data any number of times leaves the database exactly
as the first sync did.** Three mechanisms provide it:

1. **Natural key.** Products and orders have a unique index on `(storeId, shopifyId)` and are
   written with upserts on that key. A duplicate cannot be created, even by two writers.
2. **Content hash.** Each mapped document carries a SHA-256 of its canonical JSON. A batch loads
   the stored hashes in one query and skips matching documents, so unchanged data is not written
   at all (`unchanged` in the run counts) and `updatedAt` stays put.
3. **COGS snapshot is excluded from the hash** and kept across rewrites (see
   [0003](0003-cogs-snapshot.md)).

Around that: writes are batched, unordered `bulkWrite`s of 100 documents per page; one running
sync per store is enforced by a unique partial index on `SyncRun(storeId)` where
`status = 'running'` (the database is the lock, so it holds across instances); each page
updates a checkpoint, so a failed run resumes from its last written page; a document that
cannot be mapped is skipped and reported (`partial` status) instead of failing the whole run.

The invariant is tested by syncing three times and comparing document counts, net revenue,
COGS and last-write times (`services/sync.service.test.ts`).

## Consequences

- Retries, resumes and (later) duplicate webhooks are harmless.
- A re-sync of unchanged data costs one read per page and no writes.
- A rewrite is detected by hash only for Shopify-sourced fields. Changing the _mapping_ code
  (for example adding a field) changes hashes and rewrites everything once, which is the
  desired migration behaviour.
- The sync is full, not incremental: every run reads everything. Fine at the simulated scale;
  incremental sync by `updated_at` is a later change that does not alter the invariant.
- The lock lives in MongoDB with a 5-minute heartbeat timeout, so a crashed process blocks
  the store for at most that long.

## Alternatives considered

- **Delete and re-insert per sync**: trivially idempotent, but it loses the COGS snapshot and
  is destructive on failure halfway.
- **Plain upsert without a hash**: idempotent in content but rewrites every document on every
  sync (write load, constant `updatedAt` churn, no meaningful "unchanged" signal).
- **An in-process or Redis lock**: adds infrastructure, and an in-process lock fails with more
  than one instance.
