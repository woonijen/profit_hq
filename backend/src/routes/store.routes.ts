import { Router } from 'express';
import * as metricsController from '../controllers/metrics.controller.js';
import * as storeController from '../controllers/store.controller.js';
import { requireAuth } from '../middleware/require-auth.js';
import { validate } from '../middleware/validate.js';
import { summaryQuery } from '../schemas/metrics.schemas.js';
import { storeParams } from '../schemas/store.schemas.js';

export const storeRouter = Router();

storeRouter.use(requireAuth);

storeRouter.get('/', storeController.list);
storeRouter.post('/:storeId/sync', validate({ params: storeParams }), storeController.sync);
storeRouter.get(
  '/:storeId/sync/latest',
  validate({ params: storeParams }),
  storeController.latestSync,
);
storeRouter.get(
  '/:storeId/metrics/summary',
  validate({ params: storeParams, query: summaryQuery }),
  metricsController.summary,
);
