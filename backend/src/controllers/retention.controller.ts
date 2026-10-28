import type { RequestHandler } from 'express';
import { getAuth } from '../middleware/require-auth.js';
import { getValidated } from '../middleware/validate.js';
import { customerSegmentsQuery } from '../schemas/retention.schemas.js';
import * as retentionService from '../services/retention.service.js';
import { storeParams } from '../schemas/store.schemas.js';
import * as storeService from '../services/store.service.js';

export const customerSegments: RequestHandler = async (_req, res) => {
  const { params, query } = getValidated(res, {
    params: storeParams,
    query: customerSegmentsQuery,
  });
  const store = await storeService.getOwnedStore(params.storeId, getAuth(res).userId);
  res.json(await retentionService.getCustomerSegments(store, query));
};
