# 0001. Short-lived access token + rotating refresh token with reuse detection

Status: Accepted (Phase 1)

## Context

The app is a single-page application talking to its own API. Sessions must survive page reloads
and last days, but a stolen credential should be worth as little as possible. Browser storage
is the weak point: anything JavaScript can read (`localStorage`, a readable cookie) can be
taken by an XSS bug.

## Decision

Two tokens with different jobs:

- **Access token**: a signed JWT (HS256) valid for 15 minutes, sent as `Authorization: Bearer`.
  The frontend keeps it **in memory only**. A reload loses it on purpose.
- **Refresh token**: 32 random bytes in an **`httpOnly`, `SameSite=Lax` cookie scoped to
  `/api/auth`** (`Secure` in production). It is the only thing that survives a reload; the app
  uses it to get a new access token silently.

The refresh token **rotates on every use**. Each token belongs to a _family_ (one login). Using
a token marks it revoked and issues the next one in the same family. If a token that was already
rotated is presented again, someone has a copy, so **the whole family is revoked** and the user
must log in again. The claim of a token is a conditional update, so two simultaneous requests
with the same token cannot both succeed.

Only an **HMAC of the token** (keyed with the refresh secret) is stored, with the family id,
expiry, `replacedBy`, user agent and IP. A TTL index removes expired rows.

On the client, a 401 triggers one refresh shared by all concurrent requests (single-flight, and
a Web Lock across tabs), then a retry; a rejected refresh logs the user out. This matters
because of rotation: two refreshes racing with the same cookie would look like a replay.

## Consequences

- An XSS bug cannot read either token (the refresh cookie is `httpOnly`, the access token is
  not in storage), though it can still act as the user while the page is open.
- A stolen refresh token is detected the first time both the thief and the user use it, and
  the whole session dies. The cost is that a legitimate stale tab replaying an old cookie also
  logs the user out; the single-flight refresh keeps that rare.
- A database leak does not reveal usable tokens (HMAC with a secret kept outside the database).
- Access tokens cannot be revoked before they expire (15 minutes). Logout revokes the refresh
  token, which stops renewal.
- The cookie only goes to `/api/auth`, so ordinary API calls carry no ambient credentials, and
  the endpoints that do use it also check the `Origin` header (`docs/security.md`).

## Alternatives considered

- **Access token in `localStorage`**: simple, but readable by any script on the page.
- **A server-side session id cookie for everything**: simpler and instantly revocable, but every
  request is then cookie-authenticated, which brings CSRF protection into every endpoint.
- **Refresh token without rotation**: a stolen token would work silently until it expires.
- **Long-lived access token**: no refresh machinery, but a leak is a week-long problem.
