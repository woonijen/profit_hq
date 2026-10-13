/**
 * `npm run seed`: creates a demo account with a store and fills it with the simulated Shopify
 * data, so a fresh database has something to show. Safe to run again: the account is reused
 * and the sync is idempotent (a second run changes nothing).
 *
 * Writes to the database in MONGODB_URI. Never run it against production: it refuses to.
 */
import { env } from '../config/env.js';
import { connectDb, disconnectDb } from '../db/connect.js';
import { User } from '../models/user.model.js';
import { ensureDefaultStore } from '../services/store.service.js';
import { getLatestRun, toPublicRun } from '../services/sync-run.service.js';
import { startSync } from '../services/sync.service.js';
import { hashPassword } from '../utils/password.js';

const DEMO_EMAIL = env.SEED_EMAIL.toLowerCase();
const DEMO_PASSWORD = env.SEED_PASSWORD;

async function seed(): Promise<void> {
  if (env.NODE_ENV === 'production') {
    throw new Error('Refusing to seed a production database');
  }

  await connectDb();

  let user = await User.findOne({ email: DEMO_EMAIL });
  const created = !user;
  user ??= await User.create({
    email: DEMO_EMAIL,
    passwordHash: await hashPassword(DEMO_PASSWORD),
  });
  const store = await ensureDefaultStore(user._id);

  console.log(created ? `Created demo account ${DEMO_EMAIL}` : `Demo account ${DEMO_EMAIL} exists`);
  console.log(`Store ${store.shopDomain} (${store.currency}, ${store.timezone})`);
  console.log('Syncing simulated Shopify data...');

  const { done } = await startSync(store);
  await done;

  const run = await getLatestRun(store._id);
  if (!run) throw new Error('The sync left no run behind');
  const { status, products, orders, error } = toPublicRun(run);
  console.log(`Sync ${status}`);
  console.log(`  products: ${JSON.stringify(products)}`);
  console.log(`  orders:   ${JSON.stringify(orders)}`);
  if (error) throw new Error(`Sync failed: ${error.message}`);

  if (created) console.log(`\nLog in with ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
}

seed()
  .catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => void disconnectDb());
