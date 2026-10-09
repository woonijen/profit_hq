# Handoff: ProfitHQ planning + Phase 0 scaffold — 2026-10-09 04:23

## Goal

Build "ProfitHQ", a portfolio-grade Shopify net-profit dashboard (React 19 + TS + Tailwind frontend, Express + Mongoose backend, MongoDB on Atlas, JWT access + refresh-token rotation) in a monorepo. User first asked for a task list only (`todo.md`, `user_todo.md`), then asked to execute Phase 0.

## What was done

- Created `todo.md` (69 numbered tasks, 9 phases, priority order) and `user_todo.md` (11 user-only tasks) at repo root.
- Phase 0 (tasks 1–11) implemented and ticked in `todo.md`:
  - Root: `package.json` (npm workspaces, scripts, lint-staged), `tsconfig.base.json`, `eslint.config.js` (flat, type-aware via projectService), `.prettierrc.json`, `.prettierignore`, `.editorconfig`, `.gitignore`, `.nvmrc` (24), `.husky/pre-commit` (runs lint-staged).
  - `backend/`: `src/app.ts` (createApp), `src/server.ts` (listen + graceful shutdown), `src/config/{env,logger}.ts`, `src/db/connect.ts`, `src/errors/app-error.ts`, `src/middleware/{error-handler,http-logger,validate}.ts`, health route/controller/service, `.env.example`, `tsconfig.json` + `tsconfig.build.json`.
  - `frontend/`: Vite + React 19 + Tailwind 4 + TanStack Query + react-router; `src/lib/api-client.ts` (`apiFetch`, `ApiError`), `src/app/{providers,router,query-client}.tsx`, layout, error boundary, Dashboard/NotFound/RouteError pages, `.env.example`, `vite.config.ts` (`@` alias, `/api` dev proxy).
- Ran `npm install` (user_todo #5 ticked as done by Claude).

## Key decisions & why

- **Shopify Dev MCP dropped.** `.vscode/mcp.json` registers `@shopify/dev-mcp`; user first questioned whether I'd seen it, then decided it's overkill. Don't use it or add tasks for it. Mock Shopify payloads are modeled from the Admin GraphQL API shape from general knowledge, simplified.
- **Constraints from user:** do NOT commit (user commits manually); do NOT do app testing (user tests manually). Typecheck/lint/build are fine and were run.
- **No `asyncHandler`:** Express 5 forwards rejected promises; task 7 wording was edited accordingly.
- **`validate` stores parsed data on `res.locals.validated`** (read with `getValidated(res, schema)`) because Express 5 `req.query` is read-only.
- **Error envelope:** `{ error: { code, message, details?, requestId } }`; request id comes from pino-http `genReqId` and is read back from the `x-request-id` response header.
- **Vite proxies `/api` → backend** in dev so the refresh cookie (Phase 1) stays same-origin; `VITE_API_BASE_URL=/api`.
- **TypeScript pinned to `~6.0.3`** because `typescript-eslint` 8.71 supports `<6.1.0`. `@types/node` pinned `^24`. Other deps are latest from npm (react-router 8, mongoose 9, zod 4, vite 8, eslint 10).
- Env loaded via `tsx watch --env-file-if-exists=.env` (no dotenv). JWT secret/TTL vars are already in the env schema and are required, so the backend won't start until `backend/.env` is filled.
- COGS planned as a snapshot on each order line at sync time; idempotency via unique `(storeId, shopifyId)` + bulkWrite upserts + contentHash.

## Current state

- Verified: `npm run typecheck`, `npm run lint`, `npm run build`, `npm run format:check` all pass (ran after final edits).
- NOT verified: the app has never been started; no DB connection tested; no `.env` exists yet (user must create it).
- No commits made. Everything is untracked in git.
- `npm install` triggered husky `prepare`, which set `core.hooksPath` in the repo's git config.

## Open threads / next steps

1. User creates `backend/.env` and `frontend/.env` from the `.env.example` files (user_todo #1–4) and manually tests Phase 0, then commits.
2. Start **Phase 1 — Authentication (tasks 12–21)**: User model → token utils → RefreshToken model (hashed token, family id, reuse detection) → register/login/refresh/logout/me → `requireAuth` → frontend AuthProvider, 401 single-flight refresh interceptor in `api-client.ts`, login/register pages, route guards. Will need `argon2` (or bcrypt), `jsonwebtoken`/`jose`, `cookie-parser` added to the backend.
3. Then Phases 2–8 per `todo.md`.

## Added after this handoff was first written

- `CLAUDE.md` (repo root, auto-loaded): working agreement, stack, commands, conventions, domain decisions.
- `continue_instruction.md` (repo root): user's step-by-step for resuming. The "how to continue" block was removed from `todo.md`, which is now just the task board.

## Gotchas for next session

- Run all commands from the repo root; workspaces are `backend` and `frontend` (`npm run dev -w backend`).
- Backend uses NodeNext ESM: relative imports need the `.js` extension. Frontend uses the `@/` alias.
- Lint is type-aware (projectService); frontend `tsconfig.json` is solution-style (`tsconfig.app.json` / `tsconfig.node.json`).
- Local Node is v25.9 (non-LTS); `.nvmrc` says 24; engines `>=22.12`.
- `.claude/` is NOT in `.gitignore`; decide whether to ignore or commit `.claude/handoffs/`.
- Keep `todo.md` IDs stable (never renumber); tick the box when a task is done. Keep `user_todo.md` for user-only tasks.
- Plan file from the planning phase: `/Users/paolo-mac/.claude/plans/pasted-content-id-3f1d-i-want-effervescent-puddle.md` (outside repo).
