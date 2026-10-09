import type { CookieOptions, Response } from 'express';
import { env, isProduction } from '../config/env.js';

export const REFRESH_COOKIE_NAME = 'refresh_token';

const cookieOptions: CookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: 'lax',
  // Only the auth routes ever need the cookie, so it is not sent with other API calls.
  path: '/api/auth',
};

export function setRefreshCookie(res: Response, token: string): void {
  res.cookie(REFRESH_COOKIE_NAME, token, {
    ...cookieOptions,
    maxAge: env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
  });
}

export function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE_NAME, cookieOptions);
}
