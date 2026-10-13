import { createHash } from 'node:crypto';

function sortKeys(_key: string, value: unknown): unknown {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return value;
  return Object.fromEntries(Object.entries(value).sort(([a], [b]) => (a < b ? -1 : 1)));
}

/**
 * SHA-256 of a value's canonical JSON (object keys sorted, dates as ISO strings), so equal
 * content always hashes equal regardless of the order fields were built in.
 */
export function hashContent(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value, sortKeys)).digest('hex');
}
