import { describe, expect, it } from 'vitest';
import { hashContent } from './content-hash.js';

describe('hashContent', () => {
  it('ignores the order object keys were written in', () => {
    expect(hashContent({ a: 1, b: { c: 2, d: 3 } })).toBe(hashContent({ b: { d: 3, c: 2 }, a: 1 }));
  });

  it('keeps the order of array items significant', () => {
    expect(hashContent({ list: [1, 2] })).not.toBe(hashContent({ list: [2, 1] }));
  });

  it('hashes dates by their instant', () => {
    const a = hashContent({ at: new Date('2026-01-01T00:00:00Z') });
    expect(hashContent({ at: new Date('2026-01-01T00:00:00Z') })).toBe(a);
    expect(hashContent({ at: new Date('2026-01-01T00:00:01Z') })).not.toBe(a);
  });

  it('changes when any value changes', () => {
    expect(hashContent({ price: 100 })).not.toBe(hashContent({ price: 101 }));
  });
});
