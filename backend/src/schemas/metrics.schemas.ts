import { z } from 'zod';
import { RANGE_KEYS } from '../utils/date-range.js';

export const summaryQuery = z.object({
  range: z.enum(RANGE_KEYS).default('30d'),
});
