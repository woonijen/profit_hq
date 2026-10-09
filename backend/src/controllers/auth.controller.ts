import type { Request, RequestHandler } from 'express';
import { getAuth } from '../middleware/require-auth.js';
import { getValidated } from '../middleware/validate.js';
import { loginBody, registerBody } from '../schemas/auth.schemas.js';
import * as authService from '../services/auth.service.js';
import {
  clearRefreshCookie,
  REFRESH_COOKIE_NAME,
  setRefreshCookie,
} from '../utils/refresh-cookie.js';

function sessionMeta(req: Request): authService.SessionMeta {
  return { userAgent: req.get('user-agent')?.slice(0, 255), ip: req.ip };
}

function readRefreshCookie(req: Request): string | undefined {
  const value: unknown = req.cookies?.[REFRESH_COOKIE_NAME];
  return typeof value === 'string' ? value : undefined;
}

export const register: RequestHandler = async (req, res) => {
  const { body } = getValidated(res, { body: registerBody });
  const session = await authService.register(body, sessionMeta(req));
  setRefreshCookie(res, session.refreshToken);
  res.status(201).json({ user: session.user, accessToken: session.accessToken });
};

export const login: RequestHandler = async (req, res) => {
  const { body } = getValidated(res, { body: loginBody });
  const session = await authService.login(body, sessionMeta(req));
  setRefreshCookie(res, session.refreshToken);
  res.json({ user: session.user, accessToken: session.accessToken });
};

export const refresh: RequestHandler = async (req, res) => {
  try {
    const session = await authService.refresh(readRefreshCookie(req), sessionMeta(req));
    setRefreshCookie(res, session.refreshToken);
    res.json({ user: session.user, accessToken: session.accessToken });
  } catch (err) {
    clearRefreshCookie(res);
    throw err;
  }
};

export const logout: RequestHandler = async (req, res) => {
  await authService.logout(readRefreshCookie(req));
  clearRefreshCookie(res);
  res.status(204).end();
};

export const me: RequestHandler = async (_req, res) => {
  const user = await authService.getCurrentUser(getAuth(res).userId);
  res.json({ user });
};
