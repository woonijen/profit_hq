import { Router, type RequestHandler } from 'express';
import * as authController from '../controllers/auth.controller.js';
import { authRateLimit } from '../middleware/auth-rate-limit.js';
import { requireAuth } from '../middleware/require-auth.js';
import { requireSameOrigin } from '../middleware/require-same-origin.js';
import { validate } from '../middleware/validate.js';
import { loginBody, registerBody } from '../schemas/auth.schemas.js';

const passThrough: RequestHandler = (_req, _res, next) => next();

/**
 * Built per app, not once at import, so every app has its own rate-limit counters
 * (tests rely on that, or on switching the limits off).
 */
export function createAuthRouter(options: { rateLimits: boolean }): Router {
  const limit = (opts: Parameters<typeof authRateLimit>[0]) =>
    options.rateLimits ? authRateLimit(opts) : passThrough;

  const router = Router();

  // Failed logins count toward the limit, successful ones do not.
  router.post(
    '/register',
    limit({ limit: 10 }),
    validate({ body: registerBody }),
    authController.register,
  );
  router.post(
    '/login',
    limit({ limit: 10, skipSuccessfulRequests: true }),
    validate({ body: loginBody }),
    authController.login,
  );
  router.post('/refresh', requireSameOrigin, limit({ limit: 60 }), authController.refresh);
  router.post('/logout', requireSameOrigin, authController.logout);
  router.get('/me', requireAuth, authController.me);

  return router;
}
