# Handoff: Phase 9 docs done, Phase 10 (CRM Segmenter) started — 2026-10-28 04:18

## Goal

Finish Phase 9 (tasks 89–90: README/OpenAPI and ADR), then plan the CRM Segmenter feature (VIP / At-Risk / Churned) as Phase 10 tasks and start building it (tasks 91–92).

## What was done

- **Tasks 89–90 (Phase 9 done, umbrella 66 ticked)**
  - `README.md`: dead-stock, holding cost and smart markdown features, endpoints in the API table, testing blurb, project structure, docs list; removed dead stock from "Planned next". Screenshot comment left alone (user tasks #10, #21).
  - OpenAPI: nothing to add, the settings and dead-stock endpoints were already documented and covered by `backend/src/openapi/spec.test.ts`.
  - `docs/adr/0005-dead-stock-computed-on-read.md` + row in `docs/adr/README.md`.
- **Phase 10 planned** in `todo.md`: tasks 91–105 (foundation 91–93, backend 94–97, frontend 98–103, docs 104–105); backlog task 67 is the umbrella ("tick when 91–105 are done"). `user_todo.md` #26 (decisions) and #27 (name capture test), both ticked.
- **Task 91**: `docs/retention.md` written, linked from `docs/metrics.md`.
- **Task 92**: customer name captured on orders.
  - `backend/src/shopify/schemas.ts`: order `customer` now has `firstName`, `lastName` (nullable).
  - `backend/src/sync/mappers.ts`: exported `customerName()` (joins and trims, null when empty); `MappedOrder.customerName`, part of the content hash.
  - `backend/src/models/order.model.ts`: `customerName` field (default null).
  - `backend/src/shopify/mock/generator.ts`: sends the names it already generated.
  - Tests: `mappers.test.ts` (name join, guest, hash change, `customerName` table), `reconcile.test.ts` fixture, new DB test in `backend/src/services/sync.service.test.ts` (customer fields stored, guests null).
  - `docs/sync.md` notes the field and the one-time rewrite.
- Committed by the user as `3d5f052 Phase 9 docs and Phase 10 start (retention doc, customer name)`.

## Key decisions & why

The user delegated the #26 decisions ("best decide for me"). All are in `todo.md` task 91 and `docs/retention.md`:

- Unit = customer by `customerShopifyId`; guest checkouts excluded and reported as `guestOrders`.
- Counted orders = the revenue statuses (PAID, PARTIALLY_REFUNDED, REFUNDED); a fully refunded order still counts as an order but adds no spend.
- Segments, first match wins: **Churned** > 60 days since last order; **At-Risk** 31–60; **VIP** ≥ 3 orders and last order ≤ 30 days; else **Active**.
- **Fourth neutral "Active" group** was added although the spec lists three (a recent one-time buyer would otherwise be mislabeled). The user has not objected; if they want exactly three, change task 91.
- **Thresholds are 60/30, not 90/180**: I first proposed 90/180 wrongly claiming the mock history was 180 days; `MOCK_HISTORY_DAYS` is **90** (`backend/src/shopify/client-factory.ts`), so longer cut-offs could never produce Churned in the demo. Constants will live in `backend/src/retention/segments.ts` (`CHURNED_AFTER_DAYS`, `AT_RISK_AFTER_DAYS`, `VIP_MIN_ORDERS`); a real store would raise them.
- Lapsing outranks loyalty: a 10-order customer silent for 45 days is At-Risk, not VIP.
- Computed on read in two steps (one aggregation per customer, then `classify`/filter/sort/paginate in code), like dead stock; summary always covers all customers so the cards can act as filters.
- Identifier = email from the latest order with one, else the numeric Shopify id; name is a display extra.

## Current state

- Verified: `typecheck`, `lint`, `format:check`, `build` pass. `npm test` with `MONGODB_URI_TEST` (run by Claude at the user's explicit request, test DB only): backend 220/220 (none skipped), frontend 110/110.
- The user checked in Atlas that a customer order has `customerName` and a guest order has `null` (user_todo #27 ticked).
- Working tree was clean after commit `3d5f052`. This handoff, its INDEX line and `continue_instruction.md` are new, uncommitted edits.
- Phase 9 complete. Phase 10: tasks 91 and 92 done; 93–105 open.
- Not verified: Docker images (skipped by choice), GitHub Actions (no repo yet).

## Open threads / next steps

1. **Task 93**: mock data + seed produce all four segments inside the 90-day history: frequent recent buyers (VIP); frequent buyers quiet for 31–60 and for over 60 days; one-time buyers 31–60 and over 60 days ago; one-time recent buyers (Active). Keep guest checkouts. Update the seed script and expected counts, and check `generator.test.ts` and any tests with hand-computed counts. Note the generator picks customers randomly (`rng.next() ** 2`), so planted scenario customers need deterministic order dates, like the stalled products from task 72.
2. Tasks 94–97 backend: pure `segment` function, per-customer aggregation (no `$unwind`; reuse the metrics definitions for net revenue), `GET /api/stores/:id/customers/segments` (segment filter, sort `lifetimeSpend|orders|lastOrder`, pagination, summary, `guestOrders`), tests with hand-computed fixtures. Reuse `daysInactive` from `backend/src/inventory/dead-stock.ts`.
3. Tasks 98–103 frontend: hook, Customers page (URL-synced filter/sort, follow the dead-stock params pattern), badge with text and icon (not color alone), summary cards as filters (`aria-pressed`), states, tests.
4. Tasks 104–105: README + OpenAPI, ADR 0006 (segments computed on read). Add `docs/retention.md` to the README docs list then. Then tick umbrella 67.
5. Still open for the user in `user_todo.md`: #8 license, #9 GitHub repo, #10 and #21 README screenshots, #11 hosting, #20 CI secret `MONGODB_URI_TEST`. Phase 8 backlog after Phase 10: 68 OAuth, 69 deployment.

## Gotchas for next session

- `docs/retention.md` describes `backend/src/retention/` and constants that do not exist yet; it was written ahead of the code.
- The user asked Claude to run the DB tests this time; CLAUDE.md still says Claude does not, so ask first. Plain `npm test` uses `backend/.env`'s `MONGODB_URI_TEST` (separate test cluster); use `MONGODB_URI_TEST= npm test -w backend` to skip DB tests. Takes about 75 s with the DB.
- The first sync after task 92 rewrites every order once (the name is in the content hash); the mock timestamps also shift each new UTC day, so "N orders changed" on a first sync is not proof by itself.
- Claude must not run `git commit` / `git push`. Commit messages should be short ("Phase 9 - step 1" style).
- A glob such as `--include=*.ts` with no match aborts the command in zsh; quote it. macOS `sed -i` needs `-i ''`.
- `.claude/` is not in `.gitignore`; handoffs are committed with the repo.
