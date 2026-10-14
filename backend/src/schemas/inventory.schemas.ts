import { z } from 'zod';
import {
  DEAD_STOCK_SORTS,
  DEAD_STOCK_WINDOWS,
  type DeadStockWindow,
} from '../inventory/dead-stock.js';

export const MAX_PAGE_SIZE = 100;

/** Query strings arrive as text, so the window is validated as text and then turned into a number. */
const windowKeys = DEAD_STOCK_WINDOWS.map(String) as [string, ...string[]];

export const deadStockQuery = z.object({
  window: z
    .enum(windowKeys)
    .default('30')
    .transform((value) => Number(value) as DeadStockWindow),
  sort: z.enum(DEAD_STOCK_SORTS).default('daysInactive'),
  direction: z.enum(['asc', 'desc']).default('desc'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(25),
});
