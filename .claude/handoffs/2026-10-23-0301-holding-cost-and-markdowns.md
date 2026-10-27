# Handoff: Holding Cost + Smart Markdowns (Phase 9, steps 2–3) — 2026-10-23 03:01

## Goal

Continue Phase 9 (Dead-Stock Intelligence). The user said "just decide for me" on the next task, so I built step 2 (Holding Cost) and then step 3 (Smart Markdowns), backend and frontend.

## What was done

- **Holding cost (tasks 71, 76–78, 82, 84, 85)**
  - `backend/src/inventory/holding-cost.ts`: `DEFAULT_HOLDING_COST_RATE = 0.02`, `holdingCostCents()` (integer maths, half-up), `isHoldingCostRate` / `hasRatePrecision`. The rate is limited to steps of 0.0001 (0.01%) so the maths never touches floats.
  - `Store.holdingCostRate` in `models/store.model.ts` (default 0.02, validated); older stores read the default.
  - `PATCH /api/stores/:storeId/settings` (`updateSettingsBody` in `schemas/store.schemas.ts`, `updateOwnedStoreSettings` in `services/store.service.ts`, controller + route). The stores list now returns `settings.holdingCostRate`.
  - Dead-stock report gained `holdingCostRate`, per-row `holdingCostCents`, `totals.monthlyHoldingCostCents` (sum of the rounded rows over all pages). `findDeadStock` / `buildDeadStockReport` take the rate as a required last argument.
  - Frontend: `DeadStockSummary.tsx` (4 cards + skeleton), "Holding cost / month" column in `DeadStockTable.tsx`, `HoldingCostRateForm.tsx` (percent input, Save, "Saved" status), `features/inventory/holding-cost-rate.ts` (+ test), `features/stores/use-update-holding-cost-rate.ts` (writes the stores cache, invalidates `storeInventory`).
- **Smart Markdowns (tasks 79–81, 86)**
  - `backend/src/inventory/markdown.ts`: `MARKDOWN_TIERS` (90→50%, 60→30%, 30→15%), `markdownDiscountPct`, `suggestMarkdown` → `suggestedDiscountPct`, `suggestedPriceCents`, `marginAfterMarkdownCents`, `belowCost`. Rows also carry `priceCents`.
  - Frontend: `MarkdownCell.tsx` (badge, new price, struck-through old price, "⚠ Below cost: loses $X per unit" label) and a "Suggested markdown" column.
- Tests added: `holding-cost.test.ts`, `markdown.test.ts`, extra cases in `dead-stock.test.ts`, `inventory.service.test.ts`, `store-access.test.ts` (settings), `spec.test.ts` (new route), `holding-cost-rate.test.ts` (frontend).
- Docs: `docs/dead-stock.md` (Holding cost + Markdown suggestions sections), OpenAPI spec, `todo.md` ticks (71, 76–86 except 87/88), `user_todo.md` #23 and #24.
- The user committed steps 2 and 3 and pushed (last commit `f5f026e Step 3 (Smart Markdowns)`).

## Key decisions & why

- **Rate precision 0.0001**: keeps `qty × cost × rate` in integers (`rate × 10 000`), so there is no float drift and half-cent rounding is deterministic.
- **Total = sum of rounded rows**, so the total always equals what the rows add up to.
- **Settings ride on the stores list** (`store.settings`), so there is no `useStoreSettings` hook (noted in task 82).
- **Markdown tier is by the variant's own days inactive**, not by the window being viewed (a 75-day-idle variant gets 30% in the 30- and 60-day views). Equivalent to task 70's rule, since every row in a window is idle at least that long.
- **Unknown cost**: `belowCost` is false and `marginAfterMarkdownCents` is null; the row is marked "Cost missing". Selling exactly at cost is break-even, not flagged.
- PATCH settings uses Bearer auth only (no cookie), so no `requireSameOrigin`.

## Current state

- Verified by Claude: `typecheck`, `lint`, `build`, `format:check` pass; backend non-DB tests (148 pass, 62 skipped) and frontend tests (67) pass.
- Verified by the user: `npm test` 192/192 backend, including DB tests, after step 2; user_todo #22 and #23 (browser checks) done and fine.
- **Not yet verified**: user_todo #24 (Smart Markdowns, browser check) and the DB assertions added in step 3 (`inventory.service.test.ts`). The user has not reported on them.
- Not verified from earlier phases: Docker images (skipped by choice), GitHub Actions workflow (no GitHub repo yet).

## Open threads / next steps

1. User: run `npm test` (with `MONGODB_URI_TEST`) and work through user_todo #24; report anything off.
2. Task 87: skeleton / empty / error / first-run states, responsive table, dark-mode tokens, a11y pass for the Dead stock page. Most states already exist; this is largely an audit (the table is now 8 columns, `min-w-[60rem]`, so check the narrow-screen behavior).
3. Task 88: frontend tests: window filter URL sync, markdown badge (`MarkdownCell`), holding cost rate form (`HoldingCostRateForm`), formatters. Only the rate parse/format helper is tested so far.
4. Task 89: README feature list + screenshots, OpenAPI (already updated for the new endpoint and fields, so check what is left).
5. Task 90: ADR in `docs/adr` (dead-stock definition, computed on read).
6. Then tick umbrella task 66 (when 70–90 are all done); then Phase 8 backlog (67 retention, 68 OAuth, 69 deployment).
7. Still open for the user in `user_todo.md`: #8 license, #9 GitHub repo, #10 and #21 screenshots, #11 hosting, #20 CI secret.

## Gotchas for next session

- **`backend/.env` supplies `MONGODB_URI_TEST`**, so a plain `npm test` runs the DB tests. Claude does not run those (working agreement). To run only the non-DB ones: `MONGODB_URI_TEST= npm test -w backend`. I ran a plain `npm test` once by mistake; it only timed out.
- **Two Atlas clusters with separate IP allowlists**: dev `profithqcluster…` (`MONGODB_URI`) and test `testprofithqcluster…` (`MONGODB_URI_TEST`). Mongo "could not connect / IP isn't whitelisted" errors mean the current IP is missing from that cluster's Network Access list (it happened on both). Neither URI has a database name in the path.
- macOS `sed -i` needs `-i ''`; use Python or the Edit tool for file edits.
- Claude must not run `git commit` / `git push`; the user commits.
- `.claude/handoffs/` is not gitignored (earlier handoffs are in the repo).
