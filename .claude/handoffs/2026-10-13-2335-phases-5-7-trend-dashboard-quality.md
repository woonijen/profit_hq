# Handoff: Phases 5–7 done (trend, dashboard UI, quality/DX) — 2026-10-13 23:35

Supersedes `2026-10-13-1630-phases-3-4-verified-committed.md` for status. Read `docs/metrics.md`, `docs/sync.md`, `docs/security.md` and `docs/adr/` for design detail.

## Goal

Work through the rest of the task board: Phase 5 (trend backend), Phase 6 (frontend sync, dashboard, chart), Phase 7 (tests, seed, OpenAPI, CI, Docker, README, ADRs, security review).

## What was done

- **Phase 5 (tasks 42–45)**, committed by the user as `0bfe06e Phase 5`:
  - `GET /api/stores/:id/metrics/trend?range=7d|30d|90d&granularity=day|month` (`metrics/trend-pipeline.ts`, `metrics/trend.ts`, `services/metrics.service.ts#getTrend`).
  - Shared aggregation pieces extracted to `metrics/period-sums.ts`; summary and trend both use them and `deriveTotals` (`metrics/summary.ts`).
  - Buckets are named by the store's local calendar date (`YYYY-MM-DD`, the 1st for months), gaps zero-filled (`netMargin: null`), month buckets clipped to the range with `partial: true`. `utils/date-range.ts` gained `localDate`.
- **Phase 6 (tasks 46–56)**, uncommitted:
  - `frontend/src/features/{stores,metrics,sync}`: typed hooks (`useSummary`, `useTrend`, `useSyncStatus`, `useStartSync`), `lib/query-keys.ts`, sync state machine `features/sync/sync-machine.ts` (pure reducer, tracks the run id), `useSync` + `SyncProvider`/`sync-context`, `SyncButton`, `SyncStatusIndicator` (aria-live), URL-synced filters (`features/metrics/dashboard-params.ts`).
  - `components/dashboard/*` (MetricCard, SummaryCards, TrendChart lazy-loaded, empty/first-run/error states), `components/ui/{Skeleton,SegmentedControl}`, `pages/DashboardPage.tsx`, `AppLayout` header holds sync controls.
  - Design tokens + dark mode in `frontend/src/index.css` (`bg-card`, `text-ink`, `border-line`, ...); all existing pages migrated off raw slate/emerald classes. Recharts added.
- **Phase 7 (tasks 57–65)**, uncommitted:
  - Supertest tests: `backend/src/routes/auth.routes.test.ts`, `store-access.test.ts`, helpers in `backend/src/test/http.ts` (test users use domain `profithq-test.example.com`, `deleteTestUsers()` cleans up). Frontend Vitest + Testing Library: sync machine, formatters, MetricCard, route guards, sync controls (`vite.config.ts` has the `test` block, `src/test/setup.ts`).
  - `npm run seed` (`backend/src/scripts/seed.ts`): demo account + store + sync; refuses production.
  - OpenAPI 3.1: `backend/src/openapi/spec.ts` (request schemas generated from Zod), `docs.routes.ts` serves `/api/openapi.json` and Swagger UI at `/api/docs` (assets from `swagger-ui-dist`, no CDN), `spec.test.ts`.
  - `.github/workflows/ci.yml` (format, lint, typecheck, test, build; separate docker build job), `backend/Dockerfile`, `frontend/Dockerfile`, `frontend/nginx.conf`, `docker-compose.yml`, `.dockerignore`.
  - `README.md`, `docs/adr/0001–0004` + index, `docs/security.md`.
  - Security hardening from the review: `middleware/require-same-origin.ts` (403 on foreign `Origin` for refresh/logout), `middleware/sync-rate-limit.ts` (20 sync starts per user per 15 min), `COOKIE_SECURE` env (default: on in production), `SEED_EMAIL`/`SEED_PASSWORD` in `config/env.ts`. Replaced deprecated `new: true` with `returnDocument: 'after'` in `store.service.ts`.
- `todo.md`: tasks 1–65 ticked. `user_todo.md`: #16, #17, #18, #19 ticked.

## Key decisions & why

- **Dual-axis chart kept** (net revenue bars left, net margin line right) because task 52 asks for it, although the dataviz guidance says never dual axis. Both axes are labelled in the legend. Switching to two stacked charts is a small change if wanted.
- **Routers are built per app** (`createApiRouter`, `createAuthRouter`, `createStoreRouter`) and `createApp({ rateLimits })` can turn limits off. Reason: limiters created at import were shared by every app in the process, so tests exceeded the 10-registrations limit. Tests use `createApp({ rateLimits: false })`; limiter tests use `createApp()` for fresh counters.
- **Origin check on refresh/logout** is defense in depth beyond SameSite=Lax (sibling-site gap). Requests without an `Origin` header pass (non-browser clients).
- **`COOKIE_SECURE` env** exists only so a production build works over plain http (compose demo). Compose sets it to false.
- **CORS** with a fixed origin always answers with that origin; the browser blocks mismatches. Tests assert exactly that. Express 5 uses the simple query parser, so no operator objects can arrive via the query string.
- **OpenAPI by hand-written responses + Zod-generated requests** (no extra generator library); `spec.test.ts` checks structure and that query enums match the route schemas.
- **Frontend dev**: only the chart is lazy-loaded (Recharts ~390 kB chunk).

## Current state

- Verified by Claude (this session): `npm test` 137/137 backend (all DB tests, against the test DB) and 49/49 frontend; typecheck, lint, build, format:check clean. `npm run seed` twice on the test DB (second run all unchanged); HTTP walk-through on the test DB (login, refresh, foreign-origin 403 with session intact, sync 202/409, logout, refresh-after-logout 401, docs routes). Trend endpoint checks (#16). All test data was cleaned up; the dev DB was not touched by Claude.
- Verified by the user: Phase 6 UI (#17 "all looking good") and #18 including the Swagger UI check.
- **Never run / unverified:** Docker images (Docker is not installed; user chose to skip #19), the GitHub Actions workflow (no repo on GitHub yet), `npm run seed` against the dev DB.
- **Uncommitted:** all of Phase 6 and Phase 7 (last commit is `0bfe06e Phase 5`). `.claude/handoffs/` is not git-ignored; the project tracks handoffs in git on purpose.

## Open threads / next steps

1. User tasks left in `user_todo.md`: #6 commit Phases 6 and 7, #8 pick a LICENSE (README says "No license has been chosen yet"), #9 create the GitHub repo, #10/#21 README screenshots (`docs/screenshots/dashboard.png`, uncomment the image in `README.md`), #11 hosting accounts, #20 add the `MONGODB_URI_TEST` secret and check the first CI run is green.
2. If the first CI run fails in the `docker` job, fix the Dockerfiles from the error output (they have never been built). Offer: remove the docker job from `ci.yml` if the user prefers.
3. Phase 8 backlog (tasks 66–69: dead stock, customer retention, real Shopify OAuth + webhooks, deployment) is not in current scope; ask the user which to start, if any.
4. Possible polish, not started: Dependabot / scheduled `npm audit`, a hook-level test of `useSync` (polling + invalidation), a "restate costs" operation for the COGS snapshot, the accepted risks in `docs/security.md`.

## Gotchas for next session

- Shell variables do not persist between Bash calls: set env vars inside the same command (a missing `MONGODB_URI` made a server fail validation once; it did not touch any DB).
- **Never `pkill -f "src/server.ts"`**: it kills the user's own `npm run dev` backend. Start scratch servers on port 4100 and stop them with `lsof -ti tcp:4100 | xargs kill`. Recipe: from `backend/`, `MONGODB_URI="$(grep '^MONGODB_URI_TEST=' .env | cut -d= -f2-)" PORT=4100 npx tsx --env-file=.env src/server.ts`. The same override works for `npm run seed -w backend`.
- Claude does not run DB tests or the app unless the user asks (CLAUDE.md); when asked, use the test DB and clean up. Cleanup of throwaway accounts: use a scratch `.mts` run via `npx tsx` from `backend/` importing the models by absolute path (or `deleteTestUsers()` from `src/test/http.ts` for test users).
- Run `npm install ... -w frontend` / `-w backend` from the repo root, not from the workspace folder.
- Lint quirks: `expect.any(...)` and destructuring `useLocation().state` trigger `no-unsafe-assignment`; assert fields separately or cast.
- `npm test` prints a harmless Node 25 `--localstorage-file` warning (the user runs Node 25.9; `.nvmrc` says 24).
- Express 5: `req.query` is read-only, validated data is on `res.locals.validated`; CI sets `HUSKY=0`.
- Credentials: the demo password for `npm run seed` is a documented dev default (`demo-password-123`); the user's real dev login is not stored anywhere in the repo.
