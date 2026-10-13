# Handoff: Phase 2 domain model + mock Shopify implemented — 2026-10-13 13:29

## Goal

Implement Phase 2 (tasks 22–28 in `todo.md`): Mongoose domain models, Shopify payload schemas, a deterministic mock data generator and a swappable mock Shopify client.

## What was done

- **Models** in `backend/src/models/`:
  - `store.model.ts` (ownerId, unique `shopDomain`, currency, timezone)
  - `product.model.ts` (embedded variants with nullable `unitCostCents`, `inventoryQuantity`, `contentHash`, unique `(storeId, shopifyId)`)
  - `order.model.ts` (embedded `lineItems` with `unitCostCents` COGS snapshot and per-line `discountCents`, embedded `refunds`, order-level `grossCents/discountCents/taxCents/refundedCents`, `customerShopifyId/customerEmail`, `contentHash`; indexes unique `(storeId, shopifyId)` and `(storeId, processedAt)`)
  - `sync-run.model.ts` (status `running|succeeded|partial|failed`, per-entity inserted/updated/unchanged counts, `error {message, entity}`; index `(storeId, startedAt desc)` plus a unique partial index so only one `running` run per store)
  - `fields.ts`: `cents({ nullable })` schema helper (integer, min 0).
- **Store bootstrap:** `services/store.service.ts` has `ensureDefaultStore(ownerId)`, an atomic upsert keyed on a `shopDomain` derived from the owner id (`demo-<last 8 hex>.myshopify.com`, USD, UTC). `auth.service.ts` `register` now calls it right after the user is created. The user-create step was restructured so the duplicate-key (409) handling only wraps `User.create`.
- **Shopify layer** in `backend/src/shopify/`:
  - `schemas.ts`: Zod schemas and inferred types for Product/Variant, Customer, Order, LineItem, Refund, with MoneyBag, connections and `gid://` ids.
  - `shopify-client.ts`: `ShopifyClient` interface (`fetchProducts`, `fetchCustomers`, `fetchOrders`, with `{first, after}`).
  - `mock/rng.ts`: mulberry32.
  - `mock/connection.ts`: cursor `paginate` and `singlePage`.
  - `mock/generator.ts`: `generateMockShop({seed, days, endDate, ...})`.
  - `mock/mock-client.ts`: `MockShopifyClient` and `createMockShopifyClient`.
- Docs: ticked tasks 22–28 in `todo.md`; updated `continue_instruction.md` (status, steps, handoff pointer for Phase 3); added `user_todo.md` #13 (Phase 2 manual test checklist, unticked).
- Verification: `typecheck`, `lint`, `build`, `format:check` all pass. A scratch script (pure code, no DB) showed same seed ⇒ identical output, different seed ⇒ different output, all payloads parse against the Zod schemas, order money sums are consistent, and cursor pagination returns all items (seed 42, 90 days: 24 products, 150 customers, 1051 orders).

## Key decisions & why

- **Money is integer cents** (`…Cents` fields), not floats or Decimal128, so sums are exact and aggregations stay simple. Assumes two-decimal currencies; Shopify decimal strings convert in the Phase 3 mappers.
- **Variants embedded in Product** (not a separate collection): orders reference variants by `shopifyId`, and the mapper builds a lookup map from products for the COGS snapshot.
- **Simulated refunds exclude tax** (the real API includes it). This is noted in `schemas.ts`. It matches the metric definition: Net Revenue = gross − discounts − refunds, with tax tracked separately.
- **Unknown cost is `null`, not 0.** About 5% of mock variants have no cost. What COGS means for such lines is undecided and belongs in the Phase 3 mapper plus `docs/metrics.md`.
- **Mock data includes VOIDED orders (~2%)**, so the metrics must exclude them. Gross is computed from lines (`unitPrice × quantity`), and the order-level totals are denormalized for cheap matching.
- **Generator takes an explicit `endDate`** and never reads the clock; that is what keeps it deterministic.
- **`ensureDefaultStore` is called on register and will be called again by the first sync**, so users registered before Phase 2 get a store then. It is not wrapped in best-effort handling: a failure there fails registration (the user row would already exist, so a retry returns 409). Accepted as unlikely; revisit if it matters.
- **Enum lists are duplicated** between the Order model (`FINANCIAL_STATUSES`) and the Zod schema, on purpose, to avoid the model importing from the integration layer. The Phase 3 mapper's typing should catch any drift.
- The unique partial index for "one running sync per store" lives on `SyncRun` now; task 32 (service-level lock handling) is still open.

## Current state

- All Phase 2 code is written and build-verified. Nothing has been run against Atlas or the app. By project rule the user tests manually (`user_todo.md` #13).
- The Product, Order and SyncRun models are not imported anywhere yet, so their indexes will not be created until the Phase 3 sync imports them.
- Nothing is committed (user commits manually). Uncommitted: Phase 2 files, the `auth.service.ts` change, `todo.md`, `user_todo.md`, plus the older Phase 1 handoff files and `continue_instruction.md` edits.
- No automated tests exist yet (Phase 7).

## Open threads / next steps

1. User: do the `user_todo.md` #13 manual check (register → a `stores` doc appears; duplicate email → 409, no store), then commit Phase 2.
2. **Phase 3 — Idempotent Sync Engine (tasks 29–35).** Mappers (decide the null-cost COGS rule, check the order-level totals against the line sums), bulkWrite with `contentHash` skip, the sync service (products before orders, `ensureDefaultStore` first), the concurrency guard on top of the existing partial index, and `POST /api/stores/:id/sync` plus status endpoints.
3. Phase 6 needs the frontend to know the user's `storeId`, but no `GET /api/stores` endpoint exists yet. Consider adding one in Phase 3 alongside task 33.
4. Write `docs/metrics.md` (task 36) before the aggregation work. It must cover the null-cost and VOIDED handling decisions above.

## Gotchas for next session

- `CLAUDE.md` rules: no `git commit`/`push`, no app testing against the DB. Pure-code checks via a scratch script are fine; I ran this one with `npx tsx <file>.mts` from `backend/`. The script must be `.mts` (top-level await) and cannot import `zod` itself from the scratchpad (it can't resolve packages there); import repo modules by absolute path instead.
- Backend imports need `.js` extensions; run npm commands from the repo root.
- Mongoose model objects are used as `Store`, `Product`, `Order`, `SyncRun`; the inferred doc types are `StoreDoc` etc.
- Mock client usage: `createMockShopifyClient({ seed, days, endDate })`, then page with `fetchOrders({ first, after })` until `pageInfo.hasNextPage` is false. `first` must be 1–250 or it throws a `RangeError`.
- `.claude/handoffs/` is not gitignored; the user previously confirmed that committing it is fine.
- The Phase 1 gotchas still apply: a leftover `tsx watch` on port 4000 (`pkill -f "tsx watch"`), and in-memory rate-limit counters that reset on a backend restart.
