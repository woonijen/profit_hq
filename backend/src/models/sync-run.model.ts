import { type InferSchemaType, model, Schema } from 'mongoose';

export const SYNC_STATUSES = ['running', 'succeeded', 'partial', 'failed'] as const;
export const SYNC_ENTITIES = ['products', 'orders'] as const;

// How many documents of one entity type the sync inserted, changed, skipped or could not map.
const countsSchema = new Schema(
  {
    inserted: { type: Number, default: 0 },
    updated: { type: Number, default: 0 },
    unchanged: { type: Number, default: 0 },
    failed: { type: Number, default: 0 },
  },
  { _id: false },
);

// The sync aborted: it could not continue past this error.
const syncErrorSchema = new Schema(
  {
    message: { type: String, required: true },
    // Which part of the sync was running when it failed.
    entity: { type: String, enum: SYNC_ENTITIES },
  },
  { _id: false },
);

// One document that was skipped (bad payload or rejected write); the rest of the run went on.
const failureSchema = new Schema(
  {
    entity: { type: String, required: true, enum: SYNC_ENTITIES },
    shopifyId: { type: String, required: true },
    message: { type: String, required: true },
  },
  { _id: false },
);

// Where a failed run stopped, so the next run can pick up from there.
const checkpointSchema = new Schema(
  {
    entity: { type: String, required: true, enum: SYNC_ENTITIES },
    // `endCursor` of the last page that was fully written; null = nothing written yet.
    after: { type: String, default: null },
  },
  { _id: false },
);

/** One execution of the sync for a store. Doubles as the sync history and the status source. */
const syncRunSchema = new Schema(
  {
    storeId: { type: Schema.Types.ObjectId, ref: 'Store', required: true },
    status: { type: String, required: true, enum: SYNC_STATUSES, default: 'running' },
    startedAt: { type: Date, required: true, default: () => new Date() },
    // Bumped after every page. A running run whose heartbeat is old is treated as crashed.
    heartbeatAt: { type: Date, required: true, default: () => new Date() },
    finishedAt: { type: Date },
    products: { type: countsSchema, default: () => ({}) },
    orders: { type: countsSchema, default: () => ({}) },
    error: { type: syncErrorSchema },
    failures: { type: [failureSchema], default: [] },
    // Set while running, kept on `failed` (so the next run resumes), cleared otherwise.
    checkpoint: { type: checkpointSchema },
    // True when this run continued from the checkpoint of an earlier failed run.
    resumed: { type: Boolean, default: false },
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
