# How to continue (next session)

**Status:** Phases 0 (tasks 1–11) and 1 (tasks 12–21) in [todo.md](todo.md) are implemented and build-verified (typecheck, lint, build, format all pass). Both are committed and pushed; Phase 1 was manually tested. Next up: **Phase 2 — Domain model & simulated Shopify data (tasks 22+)**.

## Before starting the new session (you)

1. Run `npm install` if dependencies changed on another machine.
2. If `npm run dev` says port 4000 is in use, a leftover backend is still running: `pkill -f "tsx watch"`.

## Starting the new session

1. Open Claude Code in this repo root (`profit_hq`). [CLAUDE.md](CLAUDE.md) is loaded automatically and holds the project rules and conventions.
2. Say: `load the handoff` to read `.claude/handoffs/2026-10-10-0349-phase-1-auth-implemented.md` for the detailed context and decisions. Then say: `work on Phase 2`.
3. If anything in Phase 1 failed when you ran it, tell Claude first and it will fix that before Phase 2.

## Keeping this file useful

At the end of each session, ask Claude to run the handoff again and update the **Status** line and the "Before starting" steps here.
