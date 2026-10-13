import type { Types } from 'mongoose';
import { AppError } from '../errors/app-error.js';
import { type SYNC_ENTITIES, SyncRun, type SyncRunDoc } from '../models/sync-run.model.js';
import { isDuplicateKeyError } from '../utils/mongo-errors.js';

type SyncEntity = (typeof SYNC_ENTITIES)[number];

export interface Checkpoint {
  entity: SyncEntity;
  after: string | null;
}

export interface Failure {
  shopifyId: string;
  message: string;
}

/** A running sync that has not reported progress for this long is assumed to have crashed. */
export const STALE_AFTER_MS = 5 * 60 * 1000;
const MAX_RECORDED_FAILURES = 20;
const MAX_MESSAGE_LENGTH = 500;

/** Thrown when this sync no longer owns its run, e.g. it was declared stale and replaced. */
export class SyncSupersededError extends Error {
  constructor() {
    super('Sync run was superseded by another run');
    this.name = 'SyncSupersededError';
  }
}

export function truncateMessage(message: string): string {
  return message.length > MAX_MESSAGE_LENGTH ? `${message.slice(0, MAX_MESSAGE_LENGTH)}…` : message;
}

/** The checkpoint of the store's latest run, if that run failed part-way. */
async function findResumeCheckpoint(storeId: Types.ObjectId): Promise<Checkpoint | undefined> {
  const latest = await SyncRun.findOne({ storeId }).sort({ startedAt: -1 }).lean();
  if (latest?.status !== 'failed' || !latest.checkpoint) return undefined;
  return { entity: latest.checkpoint.entity, after: latest.checkpoint.after ?? null };
}

/** Marks the store's running run as failed if it has stopped reporting progress. */
async function failStaleRun(storeId: Types.ObjectId): Promise<boolean> {
  const result = await SyncRun.updateOne(
    {
      storeId,
      status: 'running',
      heartbeatAt: { $lt: new Date(Date.now() - STALE_AFTER_MS) },
    },
    {
      status: 'failed',
      finishedAt: new Date(),
      error: { message: 'Sync stopped responding and was abandoned' },
    },
  );
  return result.modifiedCount === 1;
}

/**
 * Starts a run for the store, or throws 409 if one is already running. The lock is the unique
 * partial index on running runs, so two simultaneous requests cannot both get one. If the
 * previous run failed part-way, the new run is created with its checkpoint and resumes there.
 */
export async function acquireSyncRun(storeId: Types.ObjectId) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const resumeFrom = await findResumeCheckpoint(storeId);
    try {
      const run = await SyncRun.create({
        storeId,
        checkpoint: resumeFrom,
        resumed: resumeFrom !== undefined,
      });
      return { run, resumeFrom };
    } catch (err) {
      if (!isDuplicateKeyError(err)) throw err;
      // A crashed run would block the store forever; clear it once and retry.
      if (attempt === 0 && (await failStaleRun(storeId))) continue;
      throw AppError.conflict('A sync is already running for this store');
    }
  }
  throw AppError.conflict('A sync is already running for this store');
}

interface Progress {
  entity: SyncEntity;
  inserted: number;
  updated: number;
  unchanged: number;
  failures: Failure[];
  /** Where to resume if the run fails after this point. */
  checkpoint: Checkpoint;
}

/** Adds a page's counts to the run and moves its checkpoint and heartbeat forward. */
export async function recordProgress(runId: Types.ObjectId, progress: Progress): Promise<void> {
  const { entity, failures } = progress;
  const result = await SyncRun.updateOne(
    { _id: runId, status: 'running' },
    {
      $inc: {
        [`${entity}.inserted`]: progress.inserted,
        [`${entity}.updated`]: progress.updated,
        [`${entity}.unchanged`]: progress.unchanged,
        [`${entity}.failed`]: failures.length,
      },
      $set: { checkpoint: progress.checkpoint, heartbeatAt: new Date() },
      $push: {
        failures: {
          // Positive $slice keeps the first N entries, so the earliest failures survive.
          $each: failures.map((f) => ({
            entity,
            shopifyId: f.shopifyId,
            message: truncateMessage(f.message),
          })),
          $slice: MAX_RECORDED_FAILURES,
        },
      },
    },
  );
  if (result.matchedCount !== 1) throw new SyncSupersededError();
}

/** Closes the run. A failed run keeps its checkpoint so the next one can resume. */
export async function finishRun(
  runId: Types.ObjectId,
  outcome:
    | { status: 'succeeded' | 'partial' }
    | { status: 'failed'; error: { message: string; entity?: SyncEntity } },
): Promise<void> {
  const failed = outcome.status === 'failed';
  await SyncRun.updateOne(
    { _id: runId, status: 'running' },
    {
      $set: {
        status: outcome.status,
        finishedAt: new Date(),
        ...(failed && {
          error: { ...outcome.error, message: truncateMessage(outcome.error.message) },
        }),
      },
      ...(!failed && { $unset: { checkpoint: '' } }),
    },
  );
}

export function getLatestRun(storeId: Types.ObjectId) {
  return SyncRun.findOne({ storeId }).sort({ startedAt: -1 });
}

type RunSource = SyncRunDoc & { _id: Types.ObjectId };

/** API shape of a run; leaves out internals such as the heartbeat and checkpoint. */
export function toPublicRun(run: RunSource) {
  return {
    id: run._id.toHexString(),
    storeId: run.storeId.toHexString(),
    status: run.status,
    startedAt: run.startedAt,
    finishedAt: run.finishedAt ?? null,
    resumed: run.resumed,
    products: run.products,
    orders: run.orders,
    error: run.error ?? null,
    failures: run.failures,
  };
}

export type PublicSyncRun = ReturnType<typeof toPublicRun>;
