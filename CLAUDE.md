# ProfitHQ

Full-stack analytics dashboard for Shopify merchants: true net profit (revenue minus COGS), later dead-stock and customer-retention insights. Portfolio project, so code quality and maintainability matter. Uses simulated Shopify payloads (no real Shopify connection yet).

## Working agreement

- **Do not run `git commit`/`git push`.** The user commits manually.
- **Do not do app testing** (starting the app and clicking around, hitting endpoints against the DB). The user tests manually. Running `typecheck`, `lint`, `build` and `format:check` is fine and expected before finishing a task.
- **Task tracking:** [todo.md](todo.md) is the source of truth for Claude's tasks. Never renumber IDs; tick `[x]` when a task is done. User-only tasks go in [user_todo.md](user_todo.md).
- **Session continuity:** see [continue_instruction.md](continue_instruction.md) and `.claude/handoffs/INDEX.md`. Run the handoff skill at the end of a session.
- The Shopify Dev MCP (`.vscode/mcp.json`) is intentionally not used.

## Stack

- Monorepo (npm workspaces): `backend/`, `frontend/`. Run commands from the repo root.
- Backend: Node (>=22.12), Express 5, TypeScript (NodeNext ESM), Mongoose 9, Zod 4, pino. MongoDB is on Atlas (no local Mongo).
- Frontend: React 19, TypeScript, Vite, Tailwind 4, TanStack Query, react-router. Recharts arrives in Phase 6.
- Auth (Phase 1): short-lived JWT access token (kept in memory client-side) + rotating refresh token in an httpOnly cookie, stored hashed with a family id; reuse of a rotated token revokes the family.

## Commands

- `npm run dev` — backend (4000) + frontend (5173), Vite proxies `/api` to the backend
- `npm run typecheck` · `npm run lint` · `npm run build` · `npm run format:check`
- Single workspace: `npm run dev -w backend`

## Conventions

- Backend layering: `routes → controllers → services → models`. Business logic lives in services; controllers only translate HTTP.
- Backend imports use the `.js` extension (NodeNext). Frontend imports use the `@/` alias for `src/`.
- Errors: throw `AppError` (`backend/src/errors/app-error.ts`). Response shape is `{ error: { code, message, details?, requestId } }`. No `asyncHandler` is needed; Express 5 forwards rejected promises.
- Request validation: `validate({ body, query, params })` then `getValidated(res, schema)`. Parsed data lives on `res.locals.validated` because `req.query` is read-only in Express 5.
- Env vars are validated with Zod in `backend/src/config/env.ts`; add new ones there and to `.env.example`.
- Frontend API calls go through `apiFetch` in `frontend/src/lib/api-client.ts` (sends cookies, throws `ApiError`).
- TypeScript is pinned to `~6.0.x` because `typescript-eslint` does not support 7 yet. Don't bump it without checking.
- Lint is type-aware; fix `no-floating-promises` etc. rather than disabling rules.

## Domain decisions (for upcoming phases)

- COGS is snapshotted onto each order line at sync time, so later cost changes don't rewrite past profit.
- Sync idempotency comes from unique `(storeId, shopifyId)` indexes, bulkWrite upserts and a `contentHash` to skip unchanged docs.
- Metric definitions go in `docs/metrics.md` (task 36): Net Revenue = gross − discounts − refunds; Net Profit = Net Revenue − COGS; AOV = Net Revenue ÷ orders; taxes tracked separately and excluded from revenue.
