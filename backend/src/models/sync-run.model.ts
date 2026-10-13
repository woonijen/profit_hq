import { type InferSchemaType, model, Schema } from 'mongoose';

export const SYNC_STATUSES = ['running', 'succeeded', 'partial', 'failed'] as const;
export const SYNC_ENTITIES = ['products', 'orders'] as const;

// How many documents of one entity type the sync inserted, changed or skipped.
const countsSchema = new Schema(
  {
    inserted: { type: Number, default: 0 },
    updated: { type: Number, default: 0 },
    unchanged: { type: Number, default: 0 },
  },
  { _id: false },
);

const syncErrorSchema = new Schema(
  {
    message: { type: String, required: true },
    // Which part of the sync was running when it failed.
    entity: { type: String, enum: SYNC_ENTITIES },
  },
  { _id: false },
);

/** One execution of the sync for a store. Doubles as the sync history and the status source. */
const syncRunSchema = new Schema(
  {
    storeId: { type: Schema.Types.ObjectId, ref: 'Store', required: true },
    status: { type: String, required: true, enum: SYNC_STATUSES, default: 'running' },
    startedAt: { type: Date, required: true, default: () => new Date() },
    finishedAt: { type: Date },
    products: { type: countsSchema, default: () => ({}) },
    orders: { type: countsSchema, default: () => ({}) },
    error: { type: syncErrorSchema },
  },
  { timestamps: true },
);

// "Latest run for a store".
syncRunSchema.index({ storeId: 1, startedAt: -1 });
// At most one running sync per store; a second concurrent insert fails with a duplicate key.
syncRunSchema.index(
  { storeId: 1 },
  { unique: true, partialFilterExpression: { status: 'running' } },
);

export type SyncRunDoc = InferSchemaType<typeof syncRunSchema>;
export const SyncRun = model('SyncRun', syncRunSchema);
