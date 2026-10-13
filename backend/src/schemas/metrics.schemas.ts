import { z } from 'zod';
import { GRANULARITIES } from '../metrics/trend-pipeline.js';
import { RANGE_KEYS } from '../utils/date-range.js';

export const summaryQuery = z.object({
  range: z.enum(RANGE_KEYS).default('30d'),
});

export const trendQuery = z.object({
  range: z.enum(RANGE_KEYS).default('30d'),
  granularity: z.enum(GRANULARITIES).default('day'),
});
