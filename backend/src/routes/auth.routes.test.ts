/**
 * HTTP tests of the auth endpoints. The first block needs no database and always runs; the
 * rest use the dedicated test database (`MONGODB_URI_TEST`) and are skipped without it.
 */
import { SignJWT } from 'jose';
import mongoose from 'mongoose';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { RefreshToken } from '../models/refresh-token.model.js';
import { User } from '../models/user.model.js';
import { hashRefreshToken, signAccessToken } from '../utils/tokens.js';
import {
  bearer,
  deleteTestUsers,
  refreshTokenFrom,
  registerUser,
  TEST_PASSWORD,
  uniqueEmail,
  withRefreshCookie,
} from '../test/http.js';

const hasTestDb = Boolean(process.env.MONGODB_URI_TEST);

/** Every error is `{ error: { code, message, requestId } }`. */
function expectErrorEnvelope(body: unknown, code: string) {
  const { error } = body as { error: { code: string; message: string; requestId: string } };
  expect(error.code).toBe(code);
  expect(error.message).toBeTruthy();
  expect(error.requestId).toBeTruthy();
}

describe('auth endpoints (no database needed)', () => {
  const app = createApp({ rateLimits: false });

  it('answers unknown routes with the standard error envelope', async () => {
    const res = await request(app).get('/api/nope');
    expect(res.status).toBe(404);
    expectErrorEnvelope(res.body, 'NOT_FOUND');
  });

  it('rejects an invalid registration before touching the database', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'not-an-email', password: 'short' });

    expect(res.status).toBe(400);
    expectErrorEnvelope(res.body, 'VALIDATION_ERROR');
    const paths = (res.body as { error: { details: { path: string }[] } }).error.details.map(
      (d) => d.path,
    );
    expect(paths).toEqual(expect.arrayContaining(['email', 'password']));
  });

  it('rejects malformed JSON with a 400, not a 500', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email": ');
    expect(res.status).toBe(400);
    expectErrorEnvelope(res.body, 'BAD_REQUEST');
  });

  it('requires a valid bearer token on protected routes', async () => {
    for (const header of [undefined, 'Bearer', 'Bearer garbage', 'Basic abc']) {
      const req = request(app).get('/api/auth/me');
      const res = await (header ? req.set('Authorization', header) : req);
      expect(res.status).toBe(401);
      expectErrorEnvelope(res.body, 'UNAUTHORIZED');
    }
  });

  it('refuses a refresh without a cookie', async () => {
    const res = await request(app).post('/api/auth/refresh');
    expect(res.status).toBe(401);
    expectErrorEnvelope(res.body, 'UNAUTHORIZED');
  });

  it('logs out idempotently and clears the cookie even when there is no session', async () => {
    const res = await request(app).post('/api/auth/logout');
    expect(res.status).toBe(204);
    expect(res.get('Set-Cookie')?.[0]).toMatch(/^refresh_token=;/);
  });

  describe('hostile input', () => {
    it.each([
      [
        'login email as an operator object',
        '/api/auth/login',
        { email: { $ne: null }, password: 'x' },
      ],
      [
        'login password as an operator object',
        '/api/auth/login',
        { email: 'a@b.co', password: { $gt: '' } },
      ],
      [
        'register email as an operator object',
        '/api/auth/register',
        { email: { $gt: '' }, password: 'long-enough-password' },
      ],
      [
        'an oversized password',
        '/api/auth/register',
        { email: 'a@b.co', password: 'x'.repeat(5000) },
      ],
    ])('rejects %s before it reaches the database', async (_name, path, body) => {
      const res = await request(app).post(path).send(body);

      expect(res.status).toBe(400);
      expectErrorEnvelope(res.body, 'VALIDATION_ERROR');
    });

    it('rejects a store id that is not a plain 24-character hex id', async () => {
      const token = await signAccessToken('507f1f77bcf86cd799439011');
      const res = await request(app)
        .get('/api/stores/%7B%22%24ne%22%3Anull%7D/metrics/summary')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(400);
    });

    it('does not accept a token signed with another secret or with alg "none"', async () => {
      const forged = [
        // header {"alg":"none"}, payload {"sub":"507f1f77bcf86cd799439011"}
        'eyJhbGciOiJub25lIn0.eyJzdWIiOiI1MDdmMWY3N2JjZjg2Y2Q3OTk0MzkwMTEifQ.',
        await new SignJWT({})
          .setProtectedHeader({ alg: 'HS256' })
          .setSubject('507f1f77bcf86cd799439011')
          .setExpirationTime('15m')
          .sign(new TextEncoder().encode('some-other-secret-0123456789abcdef0123')),
      ];
      for (const token of forged) {
        const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(401);
      }
    });

    it('does not accept an expired token', async () => {
      const expired = await new SignJWT({})
        .setProtectedHeader({ alg: 'HS256' })
        .setSubject('507f1f77bcf86cd799439011')
        .setIssuedAt(Math.floor(Date.now() / 1000) - 3600)
        .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
        .sign(new TextEncoder().encode(process.env.JWT_ACCESS_SECRET ?? ''));

      const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${expired}`);
      expect(res.status).toBe(401);
    });
  });

  describe('cross-origin protection of the cookie endpoints', () => {
    it.each(['/api/auth/refresh', '/api/auth/logout'])(
      'refuses %s from a foreign origin, even with a cookie',
      async (path) => {
        const res = await request(app)
          .post(path)
          .set('Origin', 'https://evil.example')
          .set('Cookie', 'refresh_token=anything');

        expect(res.status).toBe(403);
        expectErrorEnvelope(res.body, 'FORBIDDEN');
      },
    );

    it('lets the frontend origin through, and requests that send no origin at all', async () => {
      const fromFrontend = await request(app)
        .post('/api/auth/refresh')
        .set('Origin', process.env.CLIENT_ORIGIN ?? '');
      expect(fromFrontend.status).toBe(401); // got as far as "missing refresh token"

      const noOrigin = await request(app).post('/api/auth/refresh');
      expect(noOrigin.status).toBe(401);
    });

    it('allows credentialed CORS for the frontend origin only', async () => {
      const ok = await request(app)
        .options('/api/auth/refresh')
        .set('Origin', process.env.CLIENT_ORIGIN ?? '')
        .set('Access-Control-Request-Method', 'POST');
      expect(ok.get('Access-Control-Allow-Origin')).toBe(process.env.CLIENT_ORIGIN);
      expect(ok.get('Access-Control-Allow-Credentials')).toBe('true');

      const foreign = await request(app)
        .options('/api/auth/refresh')
        .set('Origin', 'https://evil.example')
        .set('Access-Control-Request-Method', 'POST');
      // The header always names the frontend, never the caller, so a browser on the foreign
      // origin sees a mismatch and blocks the response.
      expect(foreign.get('Access-Control-Allow-Origin')).toBe(process.env.CLIENT_ORIGIN);
      expect(foreign.get('Access-Control-Allow-Origin')).not.toBe('https://evil.example');
    });
  });

  it('sets the standard security headers and does not advertise Express', async () => {
    const res = await request(app).get('/api/health');

    expect(res.get('X-Powered-By')).toBeUndefined();
    expect(res.get('X-Content-Type-Options')).toBe('nosniff');
    expect(res.get('Content-Security-Policy')).toContain("default-src 'self'");
    expect(res.get('Strict-Transport-Security')).toBeTruthy();
  });

  it('never puts a cookie or authorization header in a response body', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('Cookie', 'refresh_token=secret-value')
      .send({ email: 'nobody@example.com', password: '' });

    expect(res.text).not.toContain('secret-value');
  });

  it('rate-limits repeated attempts with a 429 in the same envelope', async () => {
    const limited = createApp(); // rate limits on, with counters of its own
    const statuses: number[] = [];
    for (let i = 0; i < 11; i += 1) {
      const res = await request(limited).post('/api/auth/register').send({});
      statuses.push(res.status);
      if (res.status === 429) expectErrorEnvelope(res.body, 'TOO_MANY_REQUESTS');
    }
    expect(statuses).toEqual([...Array<number>(10).fill(400), 429]);
  });
});

describe('sync rate limit (no database needed)', () => {
  it('gives each user a budget of sync starts, then answers 429', async () => {
    const limited = createApp();
    const token = await signAccessToken('507f1f77bcf86cd799439011');
    const other = await signAccessToken('507f1f77bcf86cd799439012');
    // A malformed store id is rejected with a 400 before any database access, but the call
    // still counts against the budget.
    const start = (bearer: string) =>
      request(limited).post('/api/stores/nope/sync').set('Authorization', `Bearer ${bearer}`);

    const statuses: number[] = [];
    for (let i = 0; i < 21; i += 1) statuses.push((await start(token)).status);

    expect(statuses).toEqual([...Array<number>(20).fill(400), 429]);
    expect((await start(other)).status).toBe(400); // someone else's budget is untouched
  });
});

describe.skipIf(!hasTestDb)('auth flow (database)', () => {
  const app = createApp({ rateLimits: false });

  beforeAll(async () => {
    await mongoose.connect(process.env.MONGODB_URI_TEST ?? '');
    await Promise.all([User.init(), RefreshToken.init()]);
  });

  afterAll(async () => {
    await deleteTestUsers();
    await mongoose.disconnect();
  });

  describe('register', () => {
    it('creates the account, returns an access token and sets an httpOnly refresh cookie', async () => {
      const email = uniqueEmail();
      const res = await request(app)
        .post('/api/auth/register')
        .send({ email, password: TEST_PASSWORD });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ user: { email } });
      expect((res.body as { accessToken: string }).accessToken).toBeTruthy();
      // No secrets in the body: not the password hash, not the refresh token.
      const refreshToken = refreshTokenFrom(res);
      expect(refreshToken).toBeTruthy();
      const text = JSON.stringify(res.body);
      expect(text).not.toContain('passwordHash');
      expect(text).not.toContain(refreshToken ?? '');

      const cookie = res.get('Set-Cookie')?.find((c) => c.startsWith('refresh_token='));
      expect(cookie).toMatch(/HttpOnly/i);
      expect(cookie).toMatch(/SameSite=Lax/i);
      expect(cookie).toMatch(/Path=\/api\/auth/);
    });

    it('stores only a hash of the refresh token', async () => {
      const user = await registerUser(app);

      const stored = await RefreshToken.find({ userId: user.userId }).lean();
      expect(stored).toHaveLength(1);
      expect(stored[0]?.tokenHash).toBe(hashRefreshToken(user.refreshToken));
      expect(stored[0]?.tokenHash).not.toBe(user.refreshToken);
    });

    it('creates the default store with the account', async () => {
      const user = await registerUser(app);
      const res = await request(app).get('/api/stores').set('Authorization', bearer(user));

      expect(res.status).toBe(200);
      expect((res.body as { stores: unknown[] }).stores).toHaveLength(1);
    });

    it('rejects a duplicate email, whatever its case', async () => {
      const user = await registerUser(app);
      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: user.email.toUpperCase(), password: TEST_PASSWORD });

      expect(res.status).toBe(409);
      expectErrorEnvelope(res.body, 'CONFLICT');
    });
  });

  describe('login', () => {
    it('accepts the right password and is not case-sensitive about the email', async () => {
      const user = await registerUser(app);
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: ` ${user.email.toUpperCase()} `, password: TEST_PASSWORD });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ user: { id: user.userId } });
      expect((res.body as { accessToken: string }).accessToken).toBeTruthy();
      expect(refreshTokenFrom(res)).toBeTruthy();
    });

    it('answers a wrong password and an unknown email identically', async () => {
      const user = await registerUser(app);
      const wrongPassword = await request(app)
        .post('/api/auth/login')
        .send({ email: user.email, password: 'wrong-password-1' });
      const unknownEmail = await request(app)
        .post('/api/auth/login')
        .send({ email: uniqueEmail(), password: TEST_PASSWORD });

      for (const res of [wrongPassword, unknownEmail]) {
        expect(res.status).toBe(401);
        expectErrorEnvelope(res.body, 'UNAUTHORIZED');
      }
      expect((wrongPassword.body as { error: { message: string } }).error.message).toBe(
        (unknownEmail.body as { error: { message: string } }).error.message,
      );
    });

    it('blocks the 11th failed attempt with a 429, and does not count successful logins', async () => {
      const limited = createApp(); // rate limits on, with counters of its own
      const user = await registerUser(app);

      for (let i = 0; i < 5; i += 1) {
        const ok = await request(limited)
          .post('/api/auth/login')
          .send({ email: user.email, password: TEST_PASSWORD });
        expect(ok.status).toBe(200);
      }
      const statuses: number[] = [];
      for (let i = 0; i < 11; i += 1) {
        const res = await request(limited)
          .post('/api/auth/login')
          .send({ email: user.email, password: 'wrong-password-1' });
        statuses.push(res.status);
      }
      expect(statuses.slice(0, 10).every((s) => s === 401)).toBe(true);
      expect(statuses[10]).toBe(429);
    });
  });

  describe('me', () => {
    it('returns the current user for a valid access token', async () => {
      const user = await registerUser(app);
      const res = await request(app).get('/api/auth/me').set('Authorization', bearer(user));

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ user: { id: user.userId, email: user.email } });
    });

    it('rejects a token whose signature was tampered with', async () => {
      const user = await registerUser(app);
      const tampered = `${user.accessToken.slice(0, -4)}AAAA`;
      const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${tampered}`);

      expect(res.status).toBe(401);
    });
  });

  describe('refresh rotation', () => {
    it('swaps the refresh token for a new one and returns a working access token', async () => {
      const user = await registerUser(app);
      const res = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', withRefreshCookie(user.refreshToken));

      expect(res.status).toBe(200);
      const next = refreshTokenFrom(res);
      expect(next).toBeTruthy();
      expect(next).not.toBe(user.refreshToken);

      const me = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${(res.body as { accessToken: string }).accessToken}`);
      expect(me.status).toBe(200);
    });

    it('keeps the whole chain of rotated tokens in one family', async () => {
      const user = await registerUser(app);
      const second = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', withRefreshCookie(user.refreshToken));
      await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', withRefreshCookie(refreshTokenFrom(second) ?? ''));

      const records = await RefreshToken.find({ userId: user.userId }).lean();
      expect(records).toHaveLength(3);
      expect(new Set(records.map((r) => r.family)).size).toBe(1);
      expect(records.filter((r) => !r.revokedAt)).toHaveLength(1); // only the newest is live
    });

    it('revokes the whole family when an already-rotated token is replayed', async () => {
      const user = await registerUser(app);
      const rotated = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', withRefreshCookie(user.refreshToken));
      const newest = refreshTokenFrom(rotated) ?? '';

      // The attacker (or a stale tab) replays the original token...
      const replay = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', withRefreshCookie(user.refreshToken));
      expect(replay.status).toBe(401);
      expectErrorEnvelope(replay.body, 'UNAUTHORIZED');
      expect(replay.get('Set-Cookie')?.[0]).toMatch(/^refresh_token=;/); // cookie cleared

      // ...and the legitimate newest token is dead too: everyone must log in again.
      const afterwards = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', withRefreshCookie(newest));
      expect(afterwards.status).toBe(401);
      expect(await RefreshToken.countDocuments({ userId: user.userId, revokedAt: null })).toBe(0);
    });

    it('lets only one of two simultaneous refreshes with the same token succeed', async () => {
      const user = await registerUser(app);
      const send = () =>
        request(app).post('/api/auth/refresh').set('Cookie', withRefreshCookie(user.refreshToken));

      const results = await Promise.all([send(), send()]);

      expect(results.map((r) => r.status).sort()).toEqual([200, 401]);
    });

    it('rejects an unknown token', async () => {
      const res = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', withRefreshCookie('not-a-real-token'));
      expect(res.status).toBe(401);
    });

    it('rejects an expired token', async () => {
      const user = await registerUser(app);
      await RefreshToken.updateOne(
        { tokenHash: hashRefreshToken(user.refreshToken) },
        { expiresAt: new Date(Date.now() - 1000) },
      );

      const res = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', withRefreshCookie(user.refreshToken));
      expect(res.status).toBe(401);
    });

    it('does not mix up two users: one user logging in leaves the other session alone', async () => {
      const a = await registerUser(app);
      const b = await registerUser(app);
      await request(app).post('/api/auth/logout').set('Cookie', withRefreshCookie(a.refreshToken));

      const res = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', withRefreshCookie(b.refreshToken));
      expect(res.status).toBe(200);
    });
  });

  describe('logout', () => {
    it('ends the session: its refresh token stops working and the cookie is cleared', async () => {
      const user = await registerUser(app);
      const res = await request(app)
        .post('/api/auth/logout')
        .set('Cookie', withRefreshCookie(user.refreshToken));

      expect(res.status).toBe(204);
      expect(res.get('Set-Cookie')?.[0]).toMatch(/^refresh_token=;/);

      const refresh = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', withRefreshCookie(user.refreshToken));
      expect(refresh.status).toBe(401);
    });
  });
});
