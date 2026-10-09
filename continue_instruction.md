# How to continue (next session)

**Status:** Phase 0 (tasks 1–11 in [todo.md](todo.md)) is done and build-verified (typecheck, lint, build, format all pass). The app has not been run yet. Next up: **Phase 1 — Authentication (tasks 12–21)**.

## Before starting the new session (you)

1. Create `backend/.env` from `backend/.env.example` (Atlas `MONGODB_URI`, two different JWT secrets, `CLIENT_ORIGIN`) and `frontend/.env` from `frontend/.env.example`. See [user_todo.md](user_todo.md) #1–4.
2. Smoke-test Phase 0 yourself: `npm run dev` from the repo root, then open http://localhost:5173 and http://localhost:4000/api/health (expects `status: "ok"`, `database: "connected"`).
3. Review and commit Phase 0 (nothing is committed yet).

## Starting the new session

1. Open Claude Code in this repo root (`profit_hq`). [CLAUDE.md](CLAUDE.md) is loaded automatically and holds the project rules and conventions.
2. Say: `load the handoff` to read `.claude/handoffs/2026-10-09-0423-phase-0-foundation-scaffold.md` for the detailed context and decisions. Then say: `work on Phase 1`.
3. If anything in Phase 0 failed when you ran it, tell Claude first and it will fix that before Phase 1.

## Keeping this file useful

At the end of each session, ask Claude to run the handoff again and update the **Status** line and the "Before starting" steps here.
