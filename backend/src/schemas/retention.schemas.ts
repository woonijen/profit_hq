import { z } from 'zod';
import { CUSTOMER_SORTS } from '../retention/customer-report.js';
import { CUSTOMER_SEGMENTS } from '../retention/segments.js';
import { MAX_PAGE_SIZE } from './inventory.schemas.js';

export const customerSegmentsQuery = z.object({
  segment: z.enum(CUSTOMER_SEGMENTS).optional(),
  sort: z.enum(CUSTOMER_SORTS).default('lifetimeSpend'),
  direction: z.enum(['asc', 'desc']).default('desc'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(25),
});
