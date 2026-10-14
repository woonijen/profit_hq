# How to continue (next session)

**Status:** Phases 0–7 (tasks 1–65) are done and committed. Phase 9 (Dead-Stock Intelligence, tasks 70–90) is in progress: **step 1, the Dead-Stock Planner, is built but not committed** (tasks 70, 72–75 and 83 ticked; 82 partial). Typecheck, lint, build, format and the non-database tests pass; the database tests and the browser check are still yours to run. Next is step 2, Holding Cost (tasks 71, 76–78, 84–85, rest of 82), then step 3 Markdowns (79–81, 86), then polish and docs (87–90). Not verified: the Docker images (you chose to skip) and the GitHub Actions workflow (no repo on GitHub yet).

## Before starting the new session (you)

1. Run `npm test` with `MONGODB_URI_TEST` set (the new `inventory.service.test.ts` has never run), then sync again (first sync rewrites every product: new `shopifyCreatedAt`), then work through `user_todo.md` #22 and commit step 1.
2. `npm install` is only needed if dependencies changed on another machine (none changed this session).
3. If `npm run dev` says port 4000 is in use, a leftover backend is still running: `pkill -f "tsx watch"` (do this yourself; Claude must not).
4. Still open in [user_todo.md](user_todo.md): #8 license, #9 GitHub repo, #10 and #21 README screenshots, #11 hosting, #20 CI secret `MONGODB_URI_TEST`.

## Starting the new session

1. Open Claude Code in this repo root (`profit_hq`). [CLAUDE.md](CLAUDE.md) is loaded automatically and holds the project rules and conventions.
2. Say: `load the handoff` to read `.claude/handoffs/2026-10-15-0427-dead-stock-planner-step-1.md` for the detailed context and decisions.
3. Then tell Claude what to do: for example `do step 2 of Phase 9 (Holding Cost)`, or paste any failing test output from step 1.

## Keeping this file useful

At the end of each session, ask Claude to run the handoff again and update the **Status** line and the "Before starting" steps here.
