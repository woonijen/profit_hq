import { type AnyBulkWriteOperation, type Model, mongo, type Types } from 'mongoose';

/** What every synced document has in common; the key is `(storeId, shopifyId)`. */
export interface SyncDoc {
  storeId: Types.ObjectId;
  shopifyId: string;
  contentHash: string;
}

/** The part of an already stored document that the diff needs. */
export interface StoredDoc {
  shopifyId: string;
  contentHash: string;
}

export interface UpsertFailure {
  shopifyId: string;
  message: string;
}

export interface UpsertResult {
  inserted: number;
  updated: number;
  unchanged: number;
  failures: UpsertFailure[];
}

export interface UpsertOptions<T extends SyncDoc, S extends StoredDoc> {
  /** Extra stored fields to load (space separated) for `reconcile`. */
  select?: string;
  /**
   * Last chance to adjust a document that is about to be written, given what is stored now
   * (undefined for a new document). Used to keep immutable data, e.g. the COGS snapshot.
   */
  reconcile?: (incoming: T, stored: S | undefined) => T;
}

/**
 * Writes a batch of mapped documents so that re-running it changes nothing:
 *  - one query loads what is stored for the batch's ids;
 *  - documents whose `contentHash` matches are skipped (counted as unchanged);
 *  - the rest become unordered upserts keyed on `(storeId, shopifyId)`, with the key in
 *    `$setOnInsert` and everything else in `$set`.
 * A rejected write is reported in `failures`; it does not stop the others in the batch.
 */
export async function upsertChanged<TRaw, T extends SyncDoc, S extends StoredDoc = StoredDoc>(
  model: Model<TRaw>,
  storeId: Types.ObjectId,
  docs: readonly T[],
  options: UpsertOptions<T, S> = {},
): Promise<UpsertResult> {
  const result: UpsertResult = { inserted: 0, updated: 0, unchanged: 0, failures: [] };
  if (docs.length === 0) return result;

  // The same id twice in one batch would race on insert; the last copy is the freshest.
  const byId = new Map(docs.map((doc) => [doc.shopifyId, doc]));

  // Mongoose's model types are invariant in the schema's document type, so a concrete model
  // cannot be passed where `Model<T>` is expected. This view of it is safe: only the sync
  // fields are touched here.
  const syncModel = model as unknown as Model<T>;

  const stored = await syncModel
    .find({ storeId, shopifyId: { $in: [...byId.keys()] } })
    .select(`shopifyId contentHash ${options.select ?? ''}`)
    .lean<S[]>();
  const storedById = new Map(stored.map((doc) => [doc.shopifyId, doc]));

  const writes: { shopifyId: string; op: AnyBulkWriteOperation }[] = [];
  for (const [shopifyId, incoming] of byId) {
    const current = storedById.get(shopifyId);
    if (current?.contentHash === incoming.contentHash) {
      result.unchanged += 1;
      continue;
    }

    const doc = options.reconcile ? options.reconcile(incoming, current) : incoming;
    const { storeId: _storeId, shopifyId: _shopifyId, ...mutable } = doc;
    writes.push({
      shopifyId,
      op: {
        updateOne: {
          filter: { storeId, shopifyId },
          update: { $set: mutable, $setOnInsert: { storeId, shopifyId } },
          upsert: true,
        },
      },
    });
  }
  if (writes.length === 0) return result;

  const ops = writes.map((write) => write.op);
  try {
    const written = await syncModel.bulkWrite(ops, { ordered: false });
    const invalid = written.mongoose?.validationErrors ?? [];
    if (invalid.length > 0) {
      // Mapped documents are built by our own code, so this means a bug rather than bad data.
      throw new Error(`${invalid.length} documents were rejected: ${invalid[0]?.message}`);
    }
    result.inserted += written.upsertedCount;
    result.updated += written.modifiedCount;
  } catch (err) {
    if (!(err instanceof mongo.MongoBulkWriteError)) throw err;

    // Unordered: everything that could be written was; report what was not.
    result.inserted += err.result.upsertedCount;
    result.updated += err.result.modifiedCount;
    for (const writeError of [err.writeErrors].flat()) {
      result.failures.push({
        shopifyId: writes[writeError.index]?.shopifyId ?? 'unknown',
        message: writeError.errmsg ?? 'Write rejected',
      });
    }
    // A write-concern or network problem has no per-document errors: do not swallow it.
    if (result.failures.length === 0) throw err;
  }
  return result;
}
