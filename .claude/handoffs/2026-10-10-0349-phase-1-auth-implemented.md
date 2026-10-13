# Handoff: Phase 1 authentication implemented — 2026-10-10 03:49

## Goal

Load the Phase 0 handoff, then implement Phase 1 (tasks 12–21): JWT access token + rotating refresh token auth, backend and frontend.

## What was done

- Loaded the Phase 0 handoff; user had already created the `.env` files and committed Phase 0. Planned Phase 1 in plan mode, plan approved.
- **Backend** (new deps `argon2`, `jose`, `cookie-parser`, `@types/cookie-parser`):
  - `models/user.model.ts`, `models/refresh-token.model.ts` (TTL index on `expiresAt`, unique `tokenHash`, `family`, `revokedAt`, `replacedBy`)
  - `utils/{password,tokens,refresh-cookie}.ts`
  - `schemas/auth.schemas.ts`, `services/auth.service.ts`, `controllers/auth.controller.ts`, `routes/auth.routes.ts` (mounted at `/api/auth` in `routes/index.ts`; `cookieParser()` added in `app.ts`)
  - `middleware/require-auth.ts` (`requireAuth` + `getAuth(res)`), `middleware/auth-rate-limit.ts`, `middleware/rate-limit-handler.ts`
  - Endpoints: `POST /register`, `/login`, `/refresh`, `/logout`, `GET /me`
- **Frontend** (new dep `zod`):
  - `lib/auth-token.ts` (in-memory token), `lib/api-client.ts` (Bearer header, 401 → single-flight `refreshSession()` wrapped in `navigator.locks`, retry once, `onSessionExpired` listeners)
  - `features/auth/{types,auth-api,auth-context,AuthProvider,auth-schemas,CredentialsForm}.ts(x)`
  - `components/auth/{ProtectedRoute,PublicOnlyRoute,FullPageSpinner,AuthFormLayout,FormField}.tsx`
  - `pages/{LoginPage,RegisterPage}.tsx`; `app/router.tsx` and `app/providers.tsx` updated; `AppLayout` header shows user email + Log out
- Docs: ticked tasks 12–21 in `todo.md`; added `user_todo.md` #12 (Phase 1 manual test checklist; user has ticked it); updated `continue_instruction.md`.
- At user's explicit request (one-off exception to the no-app-testing rule) ran curl tests against the live backend + Atlas: reuse detection, `/me` 401s, rate limit 429. Throwaway user and its 2 refresh-token rows were deleted afterwards.
- Fixed a bug found by that test: 429 responses lacked `requestId`. They now go through `AppError` via `rateLimitHandler` (also applied to the global limiter in `app.ts`).

## Key decisions & why

- **Refresh token hashing:** HMAC-SHA256 keyed with `JWT_REFRESH_SECRET`, so lookup by hash is deterministic and a DB leak alone can't confirm guesses.
- **Cookie:** `refresh_token`, httpOnly, `secure` only in production, `sameSite: lax`, `path: /api/auth`. Works because Vite proxies `/api` (same origin). If frontend and backend are ever deployed on different sites, this needs revisiting (`sameSite`/CORS).
- **Rotation race:** atomic `updateOne({ _id, revokedAt: null })`; if nothing modified, treat as reuse and revoke the family. No grace window.
- **Single-flight refresh is load-bearing:** React StrictMode double-runs the mount effect; without a shared in-flight promise the second refresh would replay a rotated token and revoke the family. `navigator.locks` extends that across tabs.
- **`retryOnUnauthorized: false`** on login/register/refresh/logout, because a 401 there is a real answer, not an expired session. `/auth/me` does retry.
- **Network error during refresh does not log the user out**; only a 401 from `/auth/refresh` does.
- **Login:** generic "Invalid email or password"; dummy argon2 hash verified for unknown emails. Register returns 409 on duplicate email (reveals account existence; accepted trade-off). Password 10–128 chars.
- **Rate limits:** register 10 / login 10 (failed only) / refresh 60 per 15 min per IP, on top of the global 300.
- Auth identity travels on `res.locals.auth` via `getAuth(res)`, mirroring `getValidated`.

## Current state

- `typecheck`, `lint`, `build`, `format:check` all pass (last run after the 429 fix).
- Verified via curl: register → refresh rotates cookie; replaying old token → 401 "Refresh token reuse detected" and clears cookie; newest token after that → 401 (family revoked); `/me` without/with bad token → 401 envelope; 11th failed login → 429 with `requestId`.
- User says they ticked `user_todo.md` #12 (browser checklist) and pushed the code.
- Not covered: no automated tests exist yet; frontend flows were checked by the user manually, not by me.

## Open threads / next steps

1. **Phase 2 — Domain model & simulated Shopify data (task 22 onward in `todo.md`).** Start by reading it. Domain decisions in `CLAUDE.md` apply (COGS snapshot on order lines, unique `(storeId, shopifyId)`, bulkWrite upserts, `contentHash`).
2. Later: automated tests (user has a separate test DB, `user_todo.md` #2), consider moving `requireAuth` onto all future data routes.

## Gotchas for next session

- A backend dev server (`tsx watch`, pid 13802 at handoff time) was started from this session and may still be listening on port 4000. If `npm run dev` reports the port in use, run `pkill -f "tsx watch"` first (careful: it kills every tsx watch process).
- In-memory rate-limit counters reset on backend restart (touching a backend file under `tsx watch` is enough). Repeated failed logins from localhost will lock the browser out for 15 min otherwise.
- The user's backend dev DB name is `test` (from the backend log), and curl tests ran against it.
- `CLAUDE.md` says no app testing, no commits/pushes by Claude. The curl test was a one-off user-approved exception, not a standing change.
- Run commands from the repo root; backend imports need `.js` extensions, frontend uses `@/`.
- `.claude/handoffs/` is OK to commit (user confirmed); no `.gitignore` change needed.
- Throwaway-account testing convention used: emails like `*@example.invalid`, deleted via a one-off `node --env-file=.env -e` script run from `backend/`.
