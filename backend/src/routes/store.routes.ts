import { type RequestHandler, Router } from 'express';
import * as metricsController from '../controllers/metrics.controller.js';
import * as storeController from '../controllers/store.controller.js';
import { requireAuth } from '../middleware/require-auth.js';
import { syncRateLimit } from '../middleware/sync-rate-limit.js';
import { validate } from '../middleware/validate.js';
import { summaryQuery, trendQuery } from '../schemas/metrics.schemas.js';
import { storeParams } from '../schemas/store.schemas.js';

const passThrough: RequestHandler = (_req, _res, next) => next();

/** Built per app, like the auth router, so each app has its own rate-limit counters. */
export function createStoreRouter(options: { rateLimits: boolean }): Router {
  const router = Router();

  router.use(requireAuth);

  router.get('/', storeController.list);
  router.post(
    '/:storeId/sync',
    options.rateLimits ? syncRateLimit() : passThrough,
    validate({ params: storeParams }),
    storeController.sync,
  );
  router.get(
    '/:storeId/sync/latest',
    validate({ params: storeParams }),
    storeController.latestSync,
  );
  router.get(
    '/:storeId/metrics/summary',
    validate({ params: storeParams, query: summaryQuery }),
    metricsController.summary,
  );
  router.get(
    '/:storeId/metrics/trend',
    validate({ params: storeParams, query: trendQuery }),
    metricsController.trend,
  );

  return router;
}
