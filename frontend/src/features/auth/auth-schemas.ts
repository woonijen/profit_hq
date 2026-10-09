import { z } from 'zod';

// Same rules as backend/src/schemas/auth.schemas.ts; the server stays the source of truth.
export const loginSchema = z.object({
  email: z.string().trim().pipe(z.email('Enter a valid email address')),
  password: z.string().min(1, 'Enter your password'),
});

export const registerSchema = z.object({
  email: z.string().trim().pipe(z.email('Enter a valid email address')),
  password: z.string().min(10, 'Use at least 10 characters').max(128, 'Use at most 128 characters'),
});

export type FieldErrors = Partial<Record<'email' | 'password', string>>;

/** First message per field, ready to render under each input. */
export function toFieldErrors(error: z.ZodError): FieldErrors {
  const errors: FieldErrors = {};
  for (const issue of error.issues) {
    const field = issue.path[0];
    if ((field === 'email' || field === 'password') && !errors[field]) {
      errors[field] = issue.message;
    }
  }
  return errors;
}
