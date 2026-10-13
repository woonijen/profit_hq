import type { RequestHandler } from 'express';
import { getAuth } from '../middleware/require-auth.js';
import { getValidated } from '../middleware/validate.js';
import { summaryQuery } from '../schemas/metrics.schemas.js';
import { storeParams } from '../schemas/store.schemas.js';
import * as metricsService from '../services/metrics.service.js';
import * as storeService from '../services/store.service.js';

export const summary: RequestHandler = async (_req, res) => {
  const { params, query } = getValidated(res, { params: storeParams, query: summaryQuery });
  const store = await storeService.getOwnedStore(params.storeId, getAuth(res).userId);
  res.json(await metricsService.getSummary(store, query.range));
};
