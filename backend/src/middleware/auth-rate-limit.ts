import { rateLimit } from 'express-rate-limit';
import { rateLimitHandler } from './rate-limit-handler.js';

/** Brute-force guard for credential endpoints, on top of the global limiter in app.ts. */
export function authRateLimit(options: { limit: number; skipSuccessfulRequests?: boolean }) {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: options.limit,
    skipSuccessfulRequests: options.skipSuccessfulRequests ?? false,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: rateLimitHandler,
  });
}
