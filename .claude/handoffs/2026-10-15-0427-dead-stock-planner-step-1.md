# Handoff: Dead-Stock Planner (Phase 9, step 1) — 2026-10-15 04:27

## Goal

Add the Dead-Stock Intelligence features (Dead-Stock Planner, Holding Cost Calculator, Smart Markdowns). User first asked only for tasks, then approved a build order and had step 1 (Dead-Stock Planner, end to end) built.

## What was done

- **Planning:** `todo.md` Phase 9 (tasks 70–90) added; umbrella task 66 now points to it. IDs never renumbered. Priority order agreed: step 1 Planner (70, 72–75, 82+83) → step 2 Holding Cost (71, 76–78, 84–85) → step 3 Markdowns (79–81, 86) → step 4 polish/docs (87–90).
- **Ticked:** 70, 72, 73, 74, 75, 83. Task 82 is partial (useDeadStock + invalidation after sync done; settings hooks pending). Task 66 stays open until 70–90 are all done.
- **Backend:**
  - `backend/src/inventory/dead-stock.ts` (pure logic: findDeadStock, totals, sort, paging, daysInactive), `inventory/last-sold-pipeline.ts` (aggregation: last net sale per variant).
  - `services/inventory.service.ts`, `controllers/inventory.controller.ts`, `schemas/inventory.schemas.ts`, route `GET /api/stores/:storeId/inventory/dead-stock` in `routes/store.routes.ts`; OpenAPI entry + `spec.test.ts` list updated.
  - Product model/Shopify schema/mapper: new `shopifyCreatedAt` (Shopify `createdAt`), included in the content hash.
  - Mock generator (`shopify/mock/generator.ts`): `STALLED_PRODUCTS` plants products that stopped selling (20/35/50/65/80 days before end), two never-sold (one with null cost), one created 10 days ago; all ACTIVE and stocked. All products get a deterministic `createdAt` (no extra rng draws).
- **Frontend:** `features/inventory/` (types, api, `useDeadStock`, URL params hook, format), `components/inventory/` (DeadStockTable, Pagination), `pages/DeadStockPage.tsx`, route `/dead-stock`, sidebar nav item, `queryKeys.storeInventory/deadStock`, sync success also invalidates inventory queries.
- **Tests:** `inventory/dead-stock.test.ts` and `shopify/mock/generator.test.ts` (pure, run and pass); `services/inventory.service.test.ts` (DB, hand-computed fixture + explain check; NOT run); mapper test for `shopifyCreatedAt`.
- **Docs:** `docs/dead-stock.md` (definitions, performance notes, planned holding cost/markdown rules), linked from `docs/metrics.md`. `user_todo.md` #22 = manual test checklist for this step.

## Key decisions & why

- Unit of analysis = variant (where `inventoryQuantity` lives); UI shows product + variant.
- Dead for window N ⇔ ACTIVE product, stock > 0, and `daysInactive >= N`, where daysInactive = calendar days in the **store time zone** from last sale to today (same day-cutting as dashboard ranges). Windows are cumulative (90 ⊂ 60 ⊂ 30).
- A sale = line on a counted order (PAID / PARTIALLY_REFUNDED / REFUNDED, same as revenue metrics) with `quantity − refundedQuantity > 0`. Fully refunded lines are not sales; refunds never "refresh" a variant. This refined the earlier "cancelled excluded" note.
- Never-sold variants age from product `shopifyCreatedAt` (fallback to Mongo `createdAt` for pre-existing docs) so new products are not flagged. This needed the new model field.
- Computed on read (aggregation + in-memory merge), no stored flags. Aggregation has no date bound and scans all store orders per request; fine at mock scale. Escape hatch if it grows: sync-maintained per-variant `lastSoldAt` (documented in docs/dead-stock.md; ADR is task 90).
- Variants without cost: still flagged, stock value `null`, excluded from `stockValueCents`, counted in `variantsMissingCost`. Unknown ≠ free.
- Decided for later steps (written in tasks 71/79, docs): `holdingCostRate` = fraction of stock value per month, default 0.02, validated 0–1, stored on Store; markdown tiers <30d none, 30–59 → 15%, 60–89 → 30%, 90+ → 50%; warn when suggested price < unit cost.
- Stalled mock products sit near the catalog head (index 1–8) because the generator's picks are head-skewed; that makes their last sale land close to the intended cutoff.

## Current state

- Verified: `npm run typecheck`, `lint`, `build`, `format:check` pass; backend `MONGODB_URI_TEST= vitest run` → 108 passed, 51 skipped (DB tests); frontend 49/49.
- Not verified: DB tests (`inventory.service.test.ts` and the rest of the DB suite), UI in a browser, a real sync with the new `shopifyCreatedAt` field.
- User said "all looking good" after the step 1 summary; user had not yet reported manual test results for `user_todo.md` #22.
- Nothing from this session is committed (user commits manually).

## Open threads / next steps

1. User: run `npm test` with `MONGODB_URI_TEST`, re-sync (first sync rewrites every product), do `user_todo.md` #22, then commit.
2. **Step 2, Holding Cost:** 71 (Store `holdingCostRate`, default 0.02), 76 (pure cost fn, integer cents), 77 (`PATCH /api/stores/:id/settings` + holding cost per row/total in dead-stock response), 78 (tests), 84 (summary cards), 85 (rate control), finish 82 (settings hooks).
3. **Step 3, Markdowns:** 79, 80, 81, 86.
4. **Step 4:** 87 (states/a11y/dark mode pass), 88 (frontend tests, none written yet for dead-stock UI), 89 (README + OpenAPI), 90 (ADR); then tick 66.
5. Phase 8 backlog otherwise unchanged (67 retention, 68 Shopify OAuth, 69 deployment); open user tasks #8–#11, #20, #21.

## Gotchas for next session

- Never `git commit/push`; no app testing or DB-hitting runs (CLAUDE.md). Backend `.env` holds `MONGODB_URI_TEST`, so plain `vitest run` WOULD hit the test DB. To run only the pure tests safely: `cd backend && MONGODB_URI_TEST= npx vitest run <paths>` (an empty value counts as set, so the `.env` file does not override it).
- Shell cwd persists between Bash calls; use absolute paths or `cd` from the repo root.
- Money is integer cents; frontend imports use `@/`, backend imports use `.js`.
- Mongoose `.lean()` types `unitCostCents` as `number`, though it can be null at runtime; `inventory.service.ts` maps variants explicitly to get the right type.
- Dead-stock sort puts null values last regardless of direction; paging ties break by product title then variant id.
- `DeadStockPage` redirects to the last page if the URL page is past the end.
