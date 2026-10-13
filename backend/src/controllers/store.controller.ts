import type { RequestHandler } from 'express';
import { getAuth } from '../middleware/require-auth.js';
import { getValidated } from '../middleware/validate.js';
import { storeParams } from '../schemas/store.schemas.js';
import * as storeService from '../services/store.service.js';
import { getLatestRun, toPublicRun } from '../services/sync-run.service.js';
import { startSync } from '../services/sync.service.js';

function toPublicStore(store: {
  id: string;
  shopDomain: string;
  currency: string;
  timezone: string;
}) {
  const { id, shopDomain, currency, timezone } = store;
  return { id, shopDomain, currency, timezone };
}

export const list: RequestHandler = async (_req, res) => {
  const stores = await storeService.listOwnedStores(getAuth(res).userId);
  res.json({ stores: stores.map(toPublicStore) });
};

/** Starts a sync and answers right away; the client follows progress via `latestSync`. */
export const sync: RequestHandler = async (_req, res) => {
  const { params } = getValidated(res, { params: storeParams });
  const store = await storeService.getOwnedStore(params.storeId, getAuth(res).userId);
  const { run } = await startSync(store);
  res.status(202).json({ run });
};

export const latestSync: RequestHandler = async (_req, res) => {
  const { params } = getValidated(res, { params: storeParams });
  const store = await storeService.getOwnedStore(params.storeId, getAuth(res).userId);
  const run = await getLatestRun(store._id);
  res.json({ run: run ? toPublicRun(run) : null });
};
