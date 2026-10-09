import { Router } from 'express';
import * as authController from '../controllers/auth.controller.js';
import { authRateLimit } from '../middleware/auth-rate-limit.js';
import { requireAuth } from '../middleware/require-auth.js';
import { validate } from '../middleware/validate.js';
import { loginBody, registerBody } from '../schemas/auth.schemas.js';

export const authRouter = Router();

// Failed logins count toward the limit, successful ones do not.
authRouter.post(
  '/register',
  authRateLimit({ limit: 10 }),
  validate({ body: registerBody }),
  authController.register,
);
authRouter.post(
  '/login',
  authRateLimit({ limit: 10, skipSuccessfulRequests: true }),
  validate({ body: loginBody }),
  authController.login,
);
authRouter.post('/refresh', authRateLimit({ limit: 60 }), authController.refresh);
authRouter.post('/logout', authController.logout);
authRouter.get('/me', requireAuth, authController.me);
