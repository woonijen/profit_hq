# Handoff: CRM Segmenter backend, Customers page, fixed app shell — 2026-10-28 18:15

## Goal

Continue Phase 10 (CRM Segmenter: VIP / At-Risk / Churned / Active). This session built the mock data, the whole backend (tasks 93–97) and the first version of the frontend (98–99), then added a user-requested change: the browser window itself never scrolls (task 106).

## What was done

- **Task 93, mock data** (`backend/src/shopify/mock/generator.ts`): `CUSTOMER_SCENARIOS` plants 15 customers (last 15 of the list) with fixed order dates: 3 VIP, 2+2 At-Risk, 2+2 Churned, 4 Active. Days stay ≥2 from the 30/60 cuts, oldest order 84 days ago, only when `days >= 90`. They use their own RNG (`seed + 1`) and are never voided; random orders pick only from the other customers. Default `customerCount` went 150 → **600** (see decisions). Tests in `generator.test.ts`; `mappers.test.ts` `sampleOrder()` now picks a PAID order.
- **Task 94** `backend/src/retention/segments.ts`: `CUSTOMER_SEGMENTS`, `CHURNED_AFTER_DAYS=60`, `AT_RISK_AFTER_DAYS=30`, `VIP_MIN_ORDERS=3`, `segmentFor(days, orders)`; `segments.test.ts` covers every boundary.
- **Task 95** `backend/src/retention/customer-pipeline.ts`: `buildCustomerPipeline(storeId)` = `$match` store + revenue statuses, one `$group` by `customerShopifyId` (orders, `$max` processedAt, sums of gross/discount/refunded, latest email and name via `$max` of `{at, value}`). Guest checkouts land in the `_id: null` group. `toCustomerFacts()` splits customers from `guestOrders`; identifier = latest email else the number after the last `/` of the Shopify gid. Added `netRevenueCents()` to `backend/src/metrics/period-sums.ts`, now used by `deriveTotals` in `metrics/summary.ts`.
- **Task 96**: `retention/customer-report.ts` (pure: classify, summarize, sort, filter, page), `schemas/retention.schemas.ts`, `services/retention.service.ts`, `controllers/retention.controller.ts`, route `GET /api/stores/:storeId/customers/segments` in `routes/store.routes.ts`. Query: `segment`, `sort` (`lifetimeSpend` default | `orders` | `lastOrder`), `direction`, `page`, `pageSize` (max 100).
- **Task 97**: `services/retention.service.test.ts` (DB, hand-computed fixture: threshold days 30/31/61, refunded-in-full order, voided/pending ignored, guests, time zone, store isolation, empty store, `explain()` IXSCAN) and `customers/segments` added to `routes/store-access.test.ts`.
- **Task 98** frontend: `features/retention/{types,retention-api,use-customer-segments}.ts`, query keys `storeRetention` / `customerSegments` in `lib/query-keys.ts` (+ `query-keys.test.ts`), `use-sync.ts` invalidates `storeRetention` after a sync.
- **Task 99** frontend: `pages/CustomersPage.tsx` (route `/customers`, sidebar entry in `AppLayout.tsx`), `features/retention/customer-params.ts` (+ test; URL `?segment=&sort=&dir=&page=`), `components/retention/CustomerTable.tsx`, `features/retention/{format,segments}.ts`. Extracted a shared `components/ui/SortableHeader.tsx` (generic, `cellClassName` prop) used by both tables.
- **Task 106 (new, ticked)**: `AppLayout.tsx` shell is `relative flex h-dvh overflow-hidden`, `main` is `flex min-h-0 flex-1 flex-col overflow-y-auto`. `components/ui/table-styles.ts` holds the sticky header/pinned column classes. Customers table scrolls in its own box (`min-h-0 overflow-auto`) with sticky header; page root `flex min-h-96 flex-1 flex-col`. **Dead stock was put back to its old layout on request** (flows normally, sideways scroll only).
- Docs: `docs/retention.md` (pipeline, simulated data, 600 customers), `todo.md` (93–99, 106 ticked), `user_todo.md` #28–#30 added and ticked.

## Key decisions & why

- **600 customers**: with 150 customers for ~1,000 orders, 115/150 were VIP (found in a real API check). A simulation over customer counts gave 98 VIP / 126 At-Risk / 70 Churned / 146 Active at 600 (about 440 buy). Customers are not synced anywhere (`fetchCustomers` is unused), so the default is safe to change.
- **Latest email/name via `$max` of `{at, value}`**: picks the latest non-empty value with no `$sort`; uses `$type == 'string'` because `$ne: null` is true for a missing field. Guests need no second query: they are the `_id: null` group.
- **Segment checks first match, lapsing before loyalty**; `lastOrder` sort key is days since last order, so `desc` = longest silent first (matches `docs/retention.md`).
- **OpenAPI deliberately not updated yet** (task 104 does it); `spec.test.ts` only lists documented paths so it still passes.
- **Sticky headers are per cell, not on `<thead>`**, and the header line is an inset shadow (a border on a sticky cell stays behind in a collapsed table). Z-order: corner 30 > header 20 > pinned column 10.
- **`sr-only` text bug**: absolutely positioned `sr-only` elements were not clipped by the shell and let the window scroll (75px on the dashboard, ~1,800px on Dead stock). Fix: `relative` on the shell root. Keep it if the shell is touched.
- **Customers page filter is a temporary `SegmentedControl`**; task 101's summary cards (with `aria-pressed`) should replace it. The Segment column is plain text until task 100's badge.

## Current state

- Verified: `typecheck`, `lint`, `format:check`, `build` pass; frontend 125/125; backend 207 pass / 75 skipped without the DB.
- Backend with the DB: 282/282 at 17:04 (run by Claude with the user's one-time OK), **before** the last generator change (600 customers) and the `mappers.test.ts` fix. Not re-run since; the user was told to run `npm test`.
- Endpoint checked by Claude against the dev store (demo account, backend started and stopped by Claude): shape, filter, sorts, 150 rows with 0 rule violations, 400/401/404 cases. That data was the old 150-customer set.
- Browser checks by Claude (Playwright, API mocked, user's Vite): Customers at 800/500/300px high, dark mode sticky header and pinned column, keyboard scrolling, phone width on all three pages, window never scrolls (after the `relative` fix). The user checked the dashboard and Customers by eye and approved.
- All of it is uncommitted (user was about to commit; suggested message "Phase 10 - segment backend, Customers page, fixed app shell"). This handoff file, its INDEX line and `continue_instruction.md` are also uncommitted.

## Open threads / next steps

1. User: `npm test` (DB included), sync again to load the 600-customer data (Customers page then has ~440 rows, ~18 pages), restart `npm run dev` (see gotchas), commit.
2. **Task 100**: segment badge (color + text + icon, tokens for light and dark in `index.css`); replace the plain-text Segment column in `CustomerTable.tsx`. Add a manual-test task to `user_todo.md` afterwards (the user asked why none were given earlier).
3. **Task 101**: four summary cards (customers, share of revenue, average spend) that double as the filter (`aria-pressed`); remove the `SegmentedControl` filter then. `summary.segments` already has everything, `shareOfRevenue` can be null.
4. **Task 102**: skeleton/empty ("No customers yet")/error/first-run states, a11y pass. **Task 103**: frontend tests (URL sync done in `customer-params.test.tsx`; badge, cards, formatters, states left).
5. **Tasks 104–105**: README + OpenAPI entry for the endpoint (`openapi/spec.ts`, and add it to the path list in `spec.test.ts`), ADR 0006 (segments computed on read), add `docs/retention.md` to the README docs list; then tick umbrella task 67. Phase 8 backlog after: 68 OAuth, 69 deployment.
6. Still open for the user in `user_todo.md`: #8 license, #9 GitHub repo, #10 and #21 README screenshots, #11 hosting, #20 CI secret `MONGODB_URI_TEST`.

## Gotchas for next session

- **Browser checks**: Playwright is not in the repo. Install it in the scratchpad (`npm i playwright@1.64.1`); browsers are cached in `~/Library/Caches/ms-playwright`. Mock the API with `page.route('**/api/**')` (`/auth/refresh` returns `{user, accessToken}`, plus `/stores`, `/sync/latest`, and the page's endpoint).
- **Do not start a second Vite on 5173** (the user usually has `npm run dev` running): the failed start still re-optimizes the shared dependency cache and breaks the user's server (`504 Outdated Optimize Dep`, dashboard chart fails to load until they restart). Use `--port 5174 --strictPort` for your own, and kill it by its PID afterwards. This session's cache refresh is why the user must restart `npm run dev`.
- Shell cwd sticks between calls (it drifted into `backend/src` once); use absolute paths or `cd` to the repo root. zsh aborts on an unmatched glob such as `--include=*.ts` (quote it); macOS `sed -i ''`.
- CLAUDE.md says Claude does not run DB tests or test the app. This session the user explicitly asked for both (DB tests, endpoint and browser checks); treat each as one-off and ask again.
- The dev backend logs `db: "test"` on connect; not investigated. DB tests use the separate `MONGODB_URI_TEST` cluster.
- Mock timestamps shift each UTC day (window ends at the start of the current UTC day), which is why the planted customers keep ≥2 days from the cuts.
- Claude must not run `git commit` / `git push`. `.claude/` is not in `.gitignore`; handoffs are committed with the repo.
