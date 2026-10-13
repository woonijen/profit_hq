# How to continue (next session)

**Status:** All planned work, Phases 0–7 (tasks 1–65), is done and verified: 137 backend tests (including database tests), 49 frontend tests, typecheck, lint, build and format all pass. Phases 6 and 7 are **not committed yet** (last commit is `Phase 5`). Not verified: the Docker images (you chose to skip) and the GitHub Actions workflow (no repo on GitHub yet). Next up is your call: the Phase 8 backlog (tasks 66–69), or finishing the user tasks below.

## Before starting the new session (you)

1. Run `npm install` if dependencies changed on another machine (Phases 6–7 added Recharts, Supertest, Testing Library, swagger-ui-dist).
2. Review and commit Phases 6 and 7 (`user_todo.md` #6).
3. If `npm run dev` says port 4000 is in use, a leftover backend is still running: `pkill -f "tsx watch"` (do this yourself; Claude must not).
4. Still open in [user_todo.md](user_todo.md): #8 license, #9 GitHub repo, #10 and #21 README screenshots, #11 hosting, #20 CI secret `MONGODB_URI_TEST`.

## Starting the new session

1. Open Claude Code in this repo root (`profit_hq`). [CLAUDE.md](CLAUDE.md) is loaded automatically and holds the project rules and conventions.
2. Say: `load the handoff` to read `.claude/handoffs/2026-10-13-2335-phases-5-7-trend-dashboard-quality.md` for the detailed context and decisions.
3. Then tell Claude what to do: for example `start Phase 8` (dead stock, customer retention, real Shopify OAuth, deployment), or paste the CI error output if the first GitHub run fails.

## Keeping this file useful

At the end of each session, ask Claude to run the handoff again and update the **Status** line and the "Before starting" steps here.
