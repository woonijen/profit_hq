# Handoff: Phases 3–4 verified and committed, Phase 5 next — 2026-10-13 16:30

Supersedes the status in `2026-10-13-1559-phase-4-summary-metrics-backend.md` (read it and `2026-10-13-1341-phase-3-idempotent-sync-engine.md` for design detail).

## Goal

Finish and verify Phases 3 and 4 (sync engine, summary metrics backend), then hand over to Phase 5 (trend data).

## What was done

- Phase 3 (tasks 29–35) and Phase 4 (tasks 36–41) are complete, all ticked in `todo.md`. User committed both as `fb4ffa7 Phase 3 & 4`; working tree is clean.
- Verified: `npm test -w backend` 58/58 pass, including all DB tests against `MONGODB_URI_TEST` (idempotency x3, COGS snapshot, lock/409, stale takeover, resume, partial, hand-computed summary fixture, LA time zone, empty store, explain asserts IXSCAN on `storeId_1_processedAt_1`). Typecheck, lint, build, format:check pass.
- At the user's request Claude also ran the API checks and, with the user's dev login, synced their dev store: first sync inserted 24 products + 1051 orders; second sync all unchanged. Summary endpoint identities (net revenue = gross − discounts − refunds, profit = net − COGS, AOV) verified for 7d/30d/90d. `user_todo.md` #14 and #15 ticked.
- Explained: the empty frontend dashboard is expected (placeholder until Phase 6); test DB can be a second database name on the same Atlas cluster.

## Key decisions & why

(Full list in `docs/metrics.md` and `docs/sync.md`.) Highlights: only PAID/PARTIALLY_REFUNDED/REFUNDED orders count; refunds attributed to the order's period; COGS ignores refunded units (`refundedQuantity` on lines); unknown cost = 0 COGS but reported via `costCoverage`; COGS snapshot never rewritten (null stays null); summary uses one `$group` pass bucketed current/previous, no `$unwind`; no index changes.

## Current state

- Everything committed and verified. The dev DB (the user's account `woonijen8@gmail.com`, store synced) holds simulated data: 24 products, 1051 orders.
- Frontend untouched since Phase 1: dashboard is a placeholder, no stores/sync/metrics hooks, no Sync button.
- The mock shop's 90-day history means the `90d` previous-period comparison is nearly empty (expected). Mock window ends at the start of the current UTC day, so timestamps shift daily (documented in `docs/sync.md`).

## Open threads / next steps

1. **Phase 5 (tasks 42–45):** trend pipeline (`$dateTrunc` by day|month in store tz → revenue, COGS, net profit, margin), gap filling, `GET /api/stores/:storeId/metrics/trend?range=&granularity=`, tests. Reuse `resolveRange` (`utils/date-range.ts`), `REVENUE_STATUSES` (`metrics/definitions.ts`) and extract the per-order COGS expression from `metrics/summary-pipeline.ts` so summary and trend cannot diverge. Month granularity needs a decision on partial first/last months vs the range bounds.
2. Phase 6 frontend: hooks, Sync button/status, cards, chart, empty states. Optional early slice: a minimal Sync button on the dashboard.
3. Phase 7 item 57 partly done already (Vitest + setup exist); no Supertest or auth tests yet.

## Gotchas for next session

- Don't run DB tests or the app unless the user asks; when asked, use the test DB. Recipe to run the backend on port 4100: from `backend/`, `PORT=4100 npx tsx --env-file=.env src/server.ts` (dev DB) or prefix `MONGODB_URI="$(grep '^MONGODB_URI_TEST=' .env | cut -d= -f2-)"` for the test DB; kill with `pkill -f "src/server.ts"`. Clean up test-DB data afterwards (scratch cleanup script deletes users matching `p[34]check-`).
- `MONGODB_URI_TEST= npm test -w backend` skips DB tests.
- Scratch scripts: `.mts` via `npx tsx` from `backend/`, import repo modules by absolute path.
- When checking JSON in shell, don't combine a pipe with a heredoc on the same python call (stdin gets replaced).
- The user's dev password was shared in-session; it is not stored anywhere in the repo.
- Prettier rewrites files; re-read before editing. No commits by Claude.
