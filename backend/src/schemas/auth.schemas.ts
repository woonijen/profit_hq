import { z } from 'zod';

const email = z.string().trim().toLowerCase().pipe(z.email().max(254));

export const registerBody = z.object({
  email,
  // Upper bound stops very long inputs from turning argon2 into a DoS vector.
  password: z.string().min(10, 'must be at least 10 characters').max(128),
});

export const loginBody = z.object({
  email,
  password: z.string().min(1).max(128),
});
