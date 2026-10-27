# How to continue (next session)

**Status:** Phases 0–7 (tasks 1–65) are done and committed. Phase 9 (Dead-Stock Intelligence): steps 1–3 (Dead-Stock Planner, Holding Cost, Smart Markdowns; tasks 70–86) are built, committed and pushed. Typecheck, lint, build, format and all tests pass (backend 192/192 after step 2, including the database tests). Still yours: the step 3 database tests and browser check (user_todo #24). Left in Phase 9: 87 (states and accessibility pass), 88 (frontend tests), 89 (README and OpenAPI), 90 (ADR); then tick umbrella task 66. Not verified: the Docker images (you chose to skip) and the GitHub Actions workflow (no repo on GitHub yet).

## Before starting the new session (you)

1. Run `npm test` with `MONGODB_URI_TEST` set (step 3 added database assertions to `inventory.service.test.ts`), then work through `user_todo.md` #24 (Smart Markdowns in the browser).
2. If a database connection fails with an "IP isn't whitelisted" error, add your current IP in Atlas, Network Access, for that cluster (dev and test are separate clusters).
3. If `npm run dev` says port 4000 is in use, a leftover backend is still running: `pkill -f "tsx watch"` (do this yourself; Claude must not).
4. Still open in [user_todo.md](user_todo.md): #8 license, #9 GitHub repo, #10 and #21 README screenshots, #11 hosting, #20 CI secret `MONGODB_URI_TEST`.

## Starting the new session

1. Open Claude Code in this repo root (`profit_hq`). [CLAUDE.md](CLAUDE.md) is loaded automatically and holds the project rules and conventions.
2. Say: `load the handoff` to read `.claude/handoffs/2026-10-23-0301-holding-cost-and-markdowns.md` for the detailed context and decisions.
3. Then tell Claude what to do: for example `do tasks 87 and 88 of Phase 9`, or paste any failing test output from step 3.

## Keeping this file useful

At the end of each session, ask Claude to run the handoff again and update the **Status** line and the "Before starting" steps here.
