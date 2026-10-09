# How to continue (next session)

**Status:** Phases 0 (tasks 1–11) and 1 (tasks 12–21) in [todo.md](todo.md) are implemented and build-verified (typecheck, lint, build, format all pass). Phase 0 is committed; Phase 1 is uncommitted and has not been run yet. Next up: **Phase 2 — Domain model & simulated Shopify data (tasks 22+)**.

## Before starting the new session (you)

1. Run `npm install` (Phase 1 added `argon2`, `jose`, `cookie-parser` to the backend and `zod` to the frontend).
2. Test Phase 1 yourself with the checklist in [user_todo.md](user_todo.md) #12 (`npm run dev` from the repo root, then http://localhost:5173).
3. Review and commit Phase 1.

## Starting the new session

1. Open Claude Code in this repo root (`profit_hq`). [CLAUDE.md](CLAUDE.md) is loaded automatically and holds the project rules and conventions.
2. Say: `load the handoff` to read `.claude/handoffs/2026-10-09-0423-phase-0-foundation-scaffold.md` for the detailed context and decisions. Then say: `work on Phase 2`.
3. If anything in Phase 1 failed when you ran it, tell Claude first and it will fix that before Phase 2.

## Keeping this file useful

At the end of each session, ask Claude to run the handoff again and update the **Status** line and the "Before starting" steps here.
