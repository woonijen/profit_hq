import { z } from 'zod';
import { hasRatePrecision } from '../inventory/holding-cost.js';

export const storeParams = z.object({
  storeId: z.string().regex(/^[0-9a-f]{24}$/i, 'must be a valid store id'),
});

export const updateSettingsBody = z.object({
  holdingCostRate: z
    .number()
    .min(0)
    .max(1)
    .refine(hasRatePrecision, 'must be in steps of 0.0001 (0.01%)')
    .describe('Monthly holding cost as a fraction of stock value; 0.02 = 2%'),
});
