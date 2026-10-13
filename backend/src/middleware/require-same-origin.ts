import type { RequestHandler } from 'express';
import { env } from '../config/env.js';
import { AppError } from '../errors/app-error.js';

const allowedOrigin = new URL(env.CLIENT_ORIGIN).origin;

/**
 * For endpoints that act on the refresh cookie (refresh, logout): a request that declares an
 * `Origin` other than the frontend's is refused. SameSite=Lax already keeps the cookie off
 * cross-site requests; this also covers sibling sites of the same registrable domain, which
 * SameSite does not. Browsers always send `Origin` on such POSTs; requests without one are not
 * from a browser page (curl, server to server) and are let through.
 */
export const requireSameOrigin: RequestHandler = (req, _res, next) => {
  const origin = req.get('origin');
  if (origin !== undefined && origin !== allowedOrigin) {
    throw AppError.forbidden('Request origin not allowed');
  }
  next();
};
