# Handoff: Phase 3 verified, Phase 4 next — 2026-10-13 15:54

Follow-up to `2026-10-13-1341-phase-3-idempotent-sync-engine.md` (read that for the Phase 3 design and decisions).

## Goal

Close out Phase 3 (verify the sync engine), then start Phase 4 (net profit dashboard backend, tasks 36–41).

## What was done

- User set `MONGODB_URI_TEST` in `backend/.env` and ran `npm test -w backend`: 4 files, 39 tests passed, none skipped, so the 6 DB tests pass. Task 34 ticked in `todo.md`.
- At the user's request Claude ran the `user_todo.md` #14 API checks on a temporary backend (port 4100) pointed at the TEST database, then deleted all created data. Results: GET /stores creates and returns the store; two concurrent POST sync gave 202 + 409; first sync inserted 24 products / 1088 orders; syncs 2 and 3 gave 0 inserted/updated and everything unchanged; other user's store 404, no token 401, bad id 400. `user_todo.md` #14 ticked.
- Clarified with the user: the empty dashboard is expected, `DashboardPage.tsx` is a placeholder until Phase 6. Test DB can be a second database name on the same Atlas cluster (we advised against collection-prefix isolation).
- `continue_instruction.md` updated accordingly.

## Key decisions & why

- Running the API checks was a one-off exception to the CLAUDE.md "no app testing" rule, because the user asked. Done against the test DB so dev data stayed clean. The rule still stands by default.
- Nothing from Phase 3 is committed yet by Claude; the user commits manually (they may have already).

## Current state

- Phases 0–3 (tasks 1–35) done and verified. Typecheck, lint, build, format:check pass.
- Mock shop (seed 42/7 style data) has ~2% VOIDED orders, ~5% variants with null cost, refunds that exclude tax.

## Open threads / next steps

1. Phase 4: `docs/metrics.md` (task 36) first. It must decide VOIDED orders (exclude), null COGS handling, refund timing (by order processedAt vs refund date), taxes excluded.
2. Then tasks 37–41: date-range util, aggregation pipeline, summary endpoint with previous-period comparison, index review, pipeline tests with hand-computed fixture.
3. Phase 6 frontend still needs: hooks for stores/sync/metrics, Sync button, first-run state.

## Gotchas for next session

- Test DB runs: plain `npm test` uses `MONGODB_URI_TEST`; `MONGODB_URI_TEST= npm test -w backend` skips DB tests.
- To run the backend against the test DB: `MONGODB_URI="$(grep '^MONGODB_URI_TEST=' .env | cut -d= -f2-)" PORT=4100 npx tsx --env-file=.env src/server.ts` from `backend/` (env-file does not override already-set vars). Clean up afterwards.
- Scratch scripts: `.mts`, import repo modules by absolute path; scratchpad cannot resolve npm packages.
- Earlier gotchas still apply: no commits by Claude, leftover `tsx watch` on port 4000, in-memory rate limits reset on restart.
