/**
 * Schema definition for a money amount. Money is stored as integer minor units ("cents") so
 * sums never pick up float error. The simulation only uses two-decimal currencies, so
 * 1 unit = 1/100 of the currency. Shopify's decimal strings ("12.50") are converted at the
 * mapper boundary.
 *
 * With `nullable: true` the field may be `null` ("unknown"), which is distinct from 0.
 */
export function cents({ nullable = false }: { nullable?: boolean } = {}) {
  return {
    type: Number,
    required: !nullable,
    default: nullable ? null : undefined,
    min: 0,
    validate: {
      validator: (value: number | null) => value === null || Number.isInteger(value),
      message: 'must be an integer amount of cents',
    },
  };
}
