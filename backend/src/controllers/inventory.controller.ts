import type { RequestHandler } from 'express';
import { getAuth } from '../middleware/require-auth.js';
import { getValidated } from '../middleware/validate.js';
import { deadStockQuery } from '../schemas/inventory.schemas.js';
import { storeParams } from '../schemas/store.schemas.js';
import * as inventoryService from '../services/inventory.service.js';
import * as storeService from '../services/store.service.js';

export const deadStock: RequestHandler = async (_req, res) => {
  const { params, query } = getValidated(res, { params: storeParams, query: deadStockQuery });
  const store = await storeService.getOwnedStore(params.storeId, getAuth(res).userId);
  res.json(await inventoryService.getDeadStock(store, query));
};
