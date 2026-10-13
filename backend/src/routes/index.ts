import { Router } from 'express';
import { createDocsRouter } from '../openapi/docs.routes.js';
import { createAuthRouter } from './auth.routes.js';
import { healthRouter } from './health.routes.js';
import { createStoreRouter } from './store.routes.js';

/** All API routes, mounted under `/api` by the app. */
export function createApiRouter(options: { rateLimits: boolean }): Router {
  const router = Router();
  router.use('/health', healthRouter);
  router.use(createDocsRouter());
  router.use('/auth', createAuthRouter(options));
  router.use('/stores', createStoreRouter(options));
  return router;
}
