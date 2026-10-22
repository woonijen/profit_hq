/**
 * The holding cost rate is stored as a fraction (0.02) and typed as a percent ("2"). The server
 * accepts steps of 0.01%, so the input is limited to two decimals.
 */

export type ParsedRate = { ok: true; rate: number } | { ok: false; message: string };

const MESSAGE = 'Enter a percentage from 0 to 100, with at most two decimals.';

/** 0.0235 → "2.35"; 0.02 → "2". Rounds first so float noise never shows up in the field. */
export function formatRateInput(rate: number): string {
  return String(Math.round(rate * 10_000) / 100);
}

/** "2.5" or "2,5" (percent) → 0.025. Anything else is rejected with a message for the field. */
export function parseRateInput(text: string): ParsedRate {
  const normalized = text.trim().replace(',', '.').replace(/%$/, '');
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return { ok: false, message: MESSAGE };

  const basisPoints = Math.round(Number(normalized) * 100);
  if (basisPoints > 10_000) return { ok: false, message: MESSAGE };
  return { ok: true, rate: basisPoints / 10_000 };
}
