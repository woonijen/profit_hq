# Handoff: Phase 3 idempotent sync engine — 2026-10-13 13:41

## Goal

Implement Phase 3 (tasks 29–35 in `todo.md`): mappers, bulkWrite upsert layer, sync service, concurrency guard, sync endpoints, idempotency proof, partial-failure handling.

## What was done

- **Mapping** `backend/src/sync/mappers.ts`: `toCents` (string-based, no floats), `mapProduct`, `mapOrder(ctx, order, costs)`, `MappingError`. Validates currency, `gross − discounts == subtotal`, refunds sum == refunded total, and rejects nested connections with `hasNextPage`. `content-hash.ts` (`hashContent`, canonical JSON SHA-256). `reconcile.ts` (`keepStoredCogs`).
- **Bulk layer** `sync/bulk-upsert.ts`: `upsertChanged(model, storeId, docs, {select, reconcile})` loads stored hashes in one query, skips matching `contentHash`, issues unordered `updateOne` upserts (`$set` mutable, `$setOnInsert` storeId/shopifyId), returns inserted/updated/unchanged/failures.
- **Services**: `services/sync-run.service.ts` (lock via `acquireSyncRun`, stale-run takeover, `recordProgress`, `finishRun`, `toPublicRun`), `services/sync.service.ts` (`startSync` returns `{run, done}`; products → orders; page size `PAGE_SIZE = 100`), `services/store.service.ts` (+ `listOwnedStores`, `getOwnedStore`), `shopify/client-factory.ts` (`getShopifyClient`, mock seeded from store id).
- **API**: `GET /api/stores`, `POST /api/stores/:storeId/sync` (202), `GET /api/stores/:storeId/sync/latest` (files: `routes/store.routes.ts`, `controllers/store.controller.ts`, `schemas/store.schemas.ts`).
- **Model change**: `SyncRun` gained `failed` counts, `failures[]` (capped 20), `checkpoint`, `heartbeatAt`, `resumed`.
- `db/connect.ts` now awaits `Model.init()` for all models so the unique partial index (the lock) exists before serving. `utils/mongo-errors.ts` (`isDuplicateKeyError`) replaces two duplicated helpers (auth.service, error-handler).
- **Tests**: added Vitest to backend (`npm test`, `vitest.config.js`, `src/test/setup-env.ts`, `MONGODB_URI_TEST` in `.env.example`). Unit tests (mappers, content-hash, reconcile): 33 passing. DB tests in `services/sync.service.test.ts` (6): idempotency x3, COGS snapshot survives cost change, 409 on concurrent start, stale-lock takeover, fail + resume, partial + retry.
- Docs: `docs/sync.md` (flow, idempotency invariant, lock, failures), CLAUDE.md updated (test command, docs pointer), `todo.md` 29–33 and 35 ticked, `user_todo.md` #14 added.
- Verification: typecheck, lint, build, format:check all pass; unit tests pass with `MONGODB_URI_TEST=` (DB tests skipped).

## Key decisions & why

- **Task 34 is deliberately NOT ticked**: the idempotency test is written but never run, because the project rule forbids Claude hitting the DB. Tick it once the user's `npm test -w backend` passes.
- **COGS snapshot is immutable per existing line**, including `null`: the content hash excludes costs, and `keepStoredCogs` preserves stored costs on rewrite. Consequence: an order synced while cost was unknown stays null even after the merchant enters the cost. Undecided whether that should change; belongs in `docs/metrics.md` (task 36).
- **Sync runs in the background**: POST returns 202 after the lock is taken; the frontend polls `/sync/latest` (I chose `latest` over `status` for the "status|latest" in task 33).
- **Resume**: a `failed` run keeps its checkpoint; the next run resumes from it (and skips products if the checkpoint is at orders). `succeeded`/`partial` clear it. Mapping failures skip the doc (`partial`), everything else fails the run.
- **Stale lock**: running run with `heartbeatAt` older than 5 min is marked failed on the next start.
- `GET /api/stores` lazily creates the default store (covers pre-Phase-2 users), so it has a write side effect.
- Customers are not synced (no model); orders keep customer id/email.
- `bulk-upsert.ts` casts the model to `Model<T>` (Mongoose model types are invariant); commented in the code.

## Current state

- Build-verified only. Nothing run against Atlas by Claude. Seed-7 mock data (used by the tests) was checked offline: 366 orders, 24 products, all map without error.
- Uncommitted: all Phase 3 work (Phase 2 is committed as `8257b9c`).

## Open threads / next steps

1. User: run `user_todo.md` #14 (DB tests with `MONGODB_URI_TEST`, plus the manual API checks); report failures; then tick task 34 and commit.
2. **Phase 4** (tasks 36–41): write `docs/metrics.md` first, covering VOIDED orders (~2% of mock orders, must be excluded) and null COGS handling.
3. Known demo wart: the mock history window ends at the start of the current UTC day, so on a new day mock order timestamps shift and the first sync that day rewrites them (noted in `docs/sync.md`). A day-stable generator would fix it if it matters.
4. Task 57 (backend test setup) now partly exists (Vitest, setup file); extend it rather than redo it. No Supertest or auth tests yet.

## Gotchas for next session

- Run `MONGODB_URI_TEST= npm test -w backend` to run only DB-free tests; plain `npm test` hits the test DB if `MONGODB_URI_TEST` is in `backend/.env`.
- Scratch scripts: `.mts` run with `npx tsx` from `backend/`, import repo modules by absolute path; the scratchpad cannot resolve packages like mongoose.
- `vitest.config.js` is plain JS on purpose (a `.ts` file outside `src` is not in the tsconfig project and breaks type-aware lint). `tsconfig.build.json` excludes `*.test.ts` and `src/test/**`.
- Prettier rewrites files on save of `npx prettier --write`; re-read before editing.
- Earlier gotchas still apply: no commits, leftover `tsx watch` on port 4000 (`pkill -f "tsx watch"`), in-memory rate-limit counters reset on restart.
