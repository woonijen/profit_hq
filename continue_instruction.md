# How to continue (next session)

**Status:** Phases 0–3 (tasks 1–35) are done and verified. Phase 4 (tasks 36–41) is implemented and build-verified (typecheck, lint, build, format, 48 DB-free tests pass); its database tests pass (58/58) and tasks 36–41 are ticked; your dev store has been synced and the summary endpoint checked (see [user_todo.md](user_todo.md) #15). Next up: **Phase 5 — Trend data backend (tasks 42+)**.

## Before starting the new session (you)

1. Run `npm install` if dependencies changed on another machine.
2. Commit Phase 4 (tests, dev-store sync and endpoint checks are done).
3. If `npm run dev` says port 4000 is in use, a leftover backend is still running: `pkill -f "tsx watch"`.

## Starting the new session

1. Open Claude Code in this repo root (`profit_hq`). [CLAUDE.md](CLAUDE.md) is loaded automatically and holds the project rules and conventions.
2. Say: `load the handoff` to read `.claude/handoffs/2026-10-13-1559-phase-4-summary-metrics-backend.md` for the detailed context and decisions. Then say: `work on Phase 5`.
3. If anything in Phase 4 failed when you ran it, tell Claude first and it will fix that before Phase 5.

## Keeping this file useful

At the end of each session, ask Claude to run the handoff again and update the **Status** line and the "Before starting" steps here.
