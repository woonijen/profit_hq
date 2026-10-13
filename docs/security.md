# Security review

A review of the whole app against its threat model, done at the end of Phase 7. It records what
is in place, what the review changed, and what is knowingly left open. Tests that pin the
behaviour are named so a regression fails loudly.

**Threat model.** A public web app with email/password accounts. Each account owns a store whose
data must never reach another account. Attackers considered: someone guessing credentials,
someone sending hostile requests, a malicious website the user visits while signed in, and
someone who obtains a copy of the database or a refresh token. Out of scope today: real Shopify
credentials (the Shopify connection is simulated), payment data, multi-user teams.

## What is in place

| Area                | Control                                                                                                                                                                                                      | Where / test                                                                       |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| Passwords           | argon2id, library defaults (OWASP-aligned). 10–128 characters; the upper bound keeps hashing from becoming a DoS vector. Unknown emails verify a dummy hash so login timing does not reveal them.            | `utils/password.ts`, `auth.service.ts`                                             |
| Access token        | Short-lived (15 min) JWT, HS256 with the algorithm pinned on verify (no `alg: none`, no algorithm confusion). Kept in memory in the browser, never in `localStorage`.                                        | `utils/tokens.ts`, `frontend/src/lib/auth-token.ts`; tampered/forged/expired tests |
| Refresh token       | Opaque random value in an `httpOnly`, `SameSite=Lax` cookie scoped to `/api/auth`; `Secure` in production. Stored only as an HMAC; rotated on every use; replaying a rotated token revokes the whole family. | `auth.service.ts`; reuse, concurrency and expiry tests in `auth.routes.test.ts`    |
| Cross-site requests | `SameSite=Lax`, CORS limited to the single frontend origin, and `refresh`/`logout` additionally refuse a foreign `Origin` header.                                                                            | `require-same-origin.ts`; cross-origin tests                                       |
| Injection           | Every body, query and path parameter goes through Zod before use, so operator objects (`{"$ne": null}`) never reach a Mongo filter. Express 5's simple query parser produces no nested objects.              | `middleware/validate.ts`; hostile-input tests                                      |
| Authorization       | Every store route runs `requireAuth` and loads the store by `(id, ownerId)`. Someone else's store is a 404, so ids cannot be probed.                                                                         | `store.service.ts`; `store-access.test.ts`                                         |
| Rate limits         | 300 requests / 15 min per IP overall; register 10, failed logins 10, refresh 60 per IP; starting a sync 20 per user. All answer 429 in the standard error envelope.                                          | `app.ts`, `auth-rate-limit.ts`, `sync-rate-limit.ts`; limiter tests                |
| Headers             | Helmet defaults (CSP, HSTS, nosniff, frame denial); `X-Powered-By` off. The web container sets its own strict CSP.                                                                                           | `app.ts`, `frontend/nginx.conf`; header test                                       |
| Errors              | One envelope for every error; unexpected errors return a generic message with the request id and log the stack server-side only.                                                                             | `error-handler.ts`                                                                 |
| Secrets             | Validated at start (min. 32 characters, access and refresh secrets must differ); `.env` is git-ignored; the Docker build context excludes `.env`.                                                            | `config/env.ts`, `.dockerignore`                                                   |
| Request size        | JSON bodies capped at 100 kB.                                                                                                                                                                                | `app.ts`                                                                           |
| Logging             | No request bodies. `Authorization` and `Cookie` request headers and `Set-Cookie` responses are redacted. No email, password or token is ever logged by application code.                                     | `config/logger.ts`                                                                 |
| Containers          | API runs as the unprivileged `node` user; the web image is `nginx-unprivileged`; production dependencies only.                                                                                               | `backend/Dockerfile`, `frontend/Dockerfile`                                        |
| Supply chain        | `npm audit`: 0 known vulnerabilities at the time of review. Lockfile committed; CI installs with `npm ci`.                                                                                                   | `.github/workflows/ci.yml`                                                         |

## Changed by this review

- **Origin check on cookie endpoints.** `SameSite=Lax` does not stop requests from a _sibling_
  site of the same registrable domain. `refresh` and `logout` now refuse any request whose
  `Origin` differs from `CLIENT_ORIGIN`.
- **Sync budget.** Starting a sync was only covered by the global limiter. It now has its own
  per-user limit (20 per 15 minutes) on top of the one-running-sync-per-store lock.
- **`COOKIE_SECURE` setting.** The `Secure` flag was tied to `NODE_ENV=production` with no
  override, which made a production build unusable over plain `http://localhost` (Docker demo).
  It is now an explicit setting that defaults to the old behaviour, and the API logs a warning
  when it is off in production.
- **Per-app routers.** Rate limiters were created once at import time and shared by every app
  instance in the process. They are now created per app, which is what makes the limits
  testable (tests build apps with the limits off, or with fresh counters).

## Known gaps and accepted risks

These are deliberate and worth knowing before a real deployment.

1. **Email enumeration on registration.** Registering an existing email answers 409, which
   confirms the account exists. Login does not leak this. Fixing it needs email verification
   (confirm-by-mail), which is out of scope; the register limit (10 per 15 min per IP) slows
   enumeration.
2. **Access tokens cannot be revoked.** A token stays valid until it expires (15 min) even
   after logout or account deletion. Logout does revoke the refresh token, so the session cannot
   be renewed.
3. **Rate limits are per process, in memory.** With more than one API instance each has its own
   counters, and they reset on restart. A shared store (Redis) is the fix once there is more
   than one instance.
4. **`trust proxy` is set to 1.** Correct when exactly one reverse proxy (the bundled nginx, or
   the platform's router) sits in front. Exposed directly to the internet, a client could spoof
   `X-Forwarded-For` and dodge IP-based limits. Do not deploy the API directly without a proxy.
5. **IP and user agent are stored with refresh tokens** (for future session management). They
   are personal data; they are deleted automatically when the token expires (TTL index,
   7 days by default).
6. **No account lockout, password reset, MFA or email verification.** Brute force is limited by
   rate limits and argon2 cost only.
7. **`/api/health` and `/api/docs` are public.** Health reports uptime and database state; the
   API docs describe the whole API. Neither exposes data, but both can be put behind the proxy
   if that is unwanted.
8. **HS256 with a shared secret.** Fine for one service that both signs and verifies. A second
   service verifying tokens would call for asymmetric keys (RS256/EdDSA).
9. **Dependencies are not scanned continuously.** `npm audit` was clean at review time; enabling
   Dependabot or a scheduled audit job is a follow-up.
10. **Real Shopify integration will add a new class of secrets** (OAuth access tokens per
    store) that must be encrypted at rest. Not applicable while Shopify is simulated.

## Re-running this review

```sh
npm audit
npm test                      # security-relevant tests are in routes/*.test.ts
grep -rn "logger\.\|req.log" backend/src   # what is logged
```

Look again whenever authentication, CORS, cookies, the proxy setup or anything that builds a
Mongo filter from request data changes.
