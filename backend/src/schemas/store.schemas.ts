import { z } from 'zod';

export const storeParams = z.object({
  storeId: z.string().regex(/^[0-9a-f]{24}$/i, 'must be a valid store id'),
});
