import type { RequestHandler, Response } from 'express';
import { AppError } from '../errors/app-error.js';
import { type AccessTokenPayload, verifyAccessToken } from '../utils/tokens.js';

const BEARER_PREFIX = 'Bearer ';

/** Requires a valid `Authorization: Bearer <access token>`; stores the identity on `res.locals.auth`. */
export const requireAuth: RequestHandler = async (req, res, next) => {
  const header = req.get('authorization');
  if (!header?.startsWith(BEARER_PREFIX)) throw AppError.unauthorized();

  res.locals.auth = await verifyAccessToken(header.slice(BEARER_PREFIX.length));
  next();
};

/** Typed accessor for what `requireAuth` stored. Only call it on routes behind `requireAuth`. */
export function getAuth(res: Response): AccessTokenPayload {
  return res.locals.auth as AccessTokenPayload;
}
