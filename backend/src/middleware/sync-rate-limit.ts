import { rateLimit } from 'express-rate-limit';
import { getAuth } from './require-auth.js';
import { rateLimitHandler } from './rate-limit-handler.js';

/**
 * Starting a sync is the most expensive call of the API, so each user gets a small budget of
 * them (counted per account, not per IP). The one-running-sync-per-store lock already stops
 * overlaps; this stops a client from hammering start/finish cycles. Mount it after `requireAuth`.
 */
export function syncRateLimit() {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    keyGenerator: (_req, res) => getAuth(res).userId,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: rateLimitHandler,
  });
}
