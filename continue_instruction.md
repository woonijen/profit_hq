# How to continue (next session)

**Status:** Phases 0–7 and Phase 9 (Dead-Stock Intelligence, tasks 70–90) are done and committed. Phase 10 (CRM Segmenter, tasks 91–105) has started: 91 (docs/retention.md) and 92 (customer name captured on orders) are done and committed (`3d5f052`). Typecheck, lint, build, format and all tests pass (backend 220/220 including the database tests, frontend 110/110). Next: task 93 (mock data and seed that produce every segment), then the backend (94–97), frontend (98–103) and docs (104–105); then tick umbrella task 67. Not verified: the Docker images (you chose to skip) and the GitHub Actions workflow (no repo on GitHub yet).

## Before starting the new session (you)

1. Nothing is pending from the last session: `npm test` and user_todo #26 and #27 are done.
2. If a database connection fails with an "IP isn't whitelisted" error, add your current IP in Atlas, Network Access, for that cluster (dev and test are separate clusters).
3. If `npm run dev` says port 4000 is in use, a leftover backend is still running: `pkill -f "tsx watch"` (do this yourself; Claude must not).
4. Still open in [user_todo.md](user_todo.md): #8 license, #9 GitHub repo, #10 and #21 README screenshots, #11 hosting, #20 CI secret `MONGODB_URI_TEST`.

## Starting the new session

1. Open Claude Code in this repo root (`profit_hq`). [CLAUDE.md](CLAUDE.md) is loaded automatically and holds the project rules and conventions.
2. Say: `load the handoff` to read `.claude/handoffs/2026-10-28-0418-phase-9-docs-phase-10-start.md` for the detailed context and decisions.
3. Then tell Claude what to do: for example `do task 93 of Phase 10`.

## Keeping this file useful

At the end of each session, ask Claude to run the handoff again and update the **Status** line and the "Before starting" steps here.
