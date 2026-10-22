import type { RequestHandler } from 'express';
import { getAuth } from '../middleware/require-auth.js';
import { getValidated } from '../middleware/validate.js';
import { storeParams, updateSettingsBody } from '../schemas/store.schemas.js';
import * as storeService from '../services/store.service.js';
import { getLatestRun, toPublicRun } from '../services/sync-run.service.js';
import { startSync } from '../services/sync.service.js';

function toPublicSettings(store: { holdingCostRate: number }) {
  return { holdingCostRate: store.holdingCostRate };
}

function toPublicStore(store: {
  id: string;
  shopDomain: string;
  currency: string;
  timezone: string;
  holdingCostRate: number;
}) {
  const { id, shopDomain, currency, timezone } = store;
  return { id, shopDomain, currency, timezone, settings: toPublicSettings(store) };
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

export const updateSettings: RequestHandler = async (_req, res) => {
  const { params, body } = getValidated(res, { params: storeParams, body: updateSettingsBody });
  const store = await storeService.updateOwnedStoreSettings(
    params.storeId,
    getAuth(res).userId,
    body,
  );
  res.json({ settings: toPublicSettings(store) });
};
