# How to continue (next session)

**Status:** Phases 0–4 (tasks 1–41) are done, verified (58/58 tests including database tests, typecheck, lint, build, format) and committed. Your dev store is synced and the summary endpoint is checked. Next up: **Phase 5 — Trend data backend (tasks 42–45)**.

## Before starting the new session (you)

1. Run `npm install` if dependencies changed on another machine.
2. If `npm run dev` says port 4000 is in use, a leftover backend is still running: `pkill -f "tsx watch"`.

## Starting the new session

1. Open Claude Code in this repo root (`profit_hq`). [CLAUDE.md](CLAUDE.md) is loaded automatically and holds the project rules and conventions.
2. Say: `load the handoff` to read `.claude/handoffs/2026-10-13-1630-phases-3-4-verified-committed.md` for the detailed context and decisions. Then say: `work on Phase 5`.
3. If anything in Phase 4 failed when you ran it, tell Claude first and it will fix that before Phase 5.

## Keeping this file useful

At the end of each session, ask Claude to run the handoff again and update the **Status** line and the "Before starting" steps here.
