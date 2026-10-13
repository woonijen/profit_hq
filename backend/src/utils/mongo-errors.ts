/** True for MongoDB's E11000 duplicate key error (a unique index was violated). */
export function isDuplicateKeyError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'code' in err && err.code === 11000;
}
