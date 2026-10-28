# How to continue (next session)

**Status:** Phases 0–7 and 9 are done and committed. Phase 10 (CRM Segmenter, tasks 91–105) is in progress: 91–92 are committed (`3d5f052`); 93–99 and the new task 106 (the window itself no longer scrolls) are done but **not yet committed**: mock data with all four segments (600 customers), the segment pipeline and `GET /api/stores/:id/customers/segments`, DB tests, the Customers page with URL-synced filter and sort. Typecheck, lint, build, format and the frontend tests (125) pass; the backend DB tests passed (282/282) before the last mock-data change and have not been re-run since. Next: task 100 (segment badge), then 101 (summary cards as filters, replacing the temporary filter buttons), 102, 103 (frontend tests), 104–105 (README, OpenAPI, ADR 0006), then tick umbrella task 67. Not verified: the Docker images (you chose to skip) and the GitHub Actions workflow (no repo on GitHub yet).

## Before starting the new session (you)

1. Run `npm test` (with `MONGODB_URI_TEST`), run `npm run seed` or the Sync button once (the mock data changed: 600 customers, so the first sync rewrites orders again), restart `npm run dev` (a Vite cache refresh may have broken the dashboard chart in your running server), then commit the uncommitted work.
2. If a database connection fails with an "IP isn't whitelisted" error, add your current IP in Atlas, Network Access, for that cluster (dev and test are separate clusters).
3. If `npm run dev` says port 4000 is in use, a leftover backend is still running: `pkill -f "tsx watch"` (do this yourself; Claude must not).
4. Still open in [user_todo.md](user_todo.md): #8 license, #9 GitHub repo, #10 and #21 README screenshots, #11 hosting, #20 CI secret `MONGODB_URI_TEST`.

## Starting the new session

1. Open Claude Code in this repo root (`profit_hq`). [CLAUDE.md](CLAUDE.md) is loaded automatically and holds the project rules and conventions.
2. Say: `load the handoff` to read `.claude/handoffs/2026-10-28-1813-phase-10-segments-customers-page-shell.md` for the detailed context and decisions.
3. Then tell Claude what to do: for example `do task 100 of Phase 10`.

## Keeping this file useful

At the end of each session, ask Claude to run the handoff again and update the **Status** line and the "Before starting" steps here.
