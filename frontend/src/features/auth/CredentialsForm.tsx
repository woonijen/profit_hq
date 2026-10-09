import { type SubmitEvent, useState } from 'react';
import type { z } from 'zod';
import { FormField } from '@/components/auth/FormField';
import { ApiError } from '@/lib/api-client';
import { type FieldErrors, toFieldErrors } from './auth-schemas';

interface CredentialsFormProps {
  schema: z.ZodType<{ email: string; password: string }>;
  submitLabel: string;
  pendingLabel: string;
  passwordAutoComplete: 'current-password' | 'new-password';
  onSubmit: (credentials: { email: string; password: string }) => Promise<void>;
}

/** Email + password form shared by the login and register pages. */
export function CredentialsForm({
  schema,
  submitLabel,
  pendingLabel,
  passwordAutoComplete,
  onSubmit,
}: CredentialsFormProps) {
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const parsed = schema.safeParse({ email: data.get('email'), password: data.get('password') });

    setFormError(null);
    if (!parsed.success) {
      setFieldErrors(toFieldErrors(parsed.error));
      return;
    }
    setFieldErrors({});

    setPending(true);
    try {
      await onSubmit(parsed.data);
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : 'Something went wrong. Try again.');
      setPending(false);
    }
    // On success the route guard navigates away, so `pending` is left on until unmount.
  }

  return (
    <form onSubmit={(event) => void handleSubmit(event)} noValidate className="space-y-4">
      {formError && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {formError}
        </p>
      )}
      <FormField
        id="email"
        name="email"
        type="email"
        label="Email"
        autoComplete="email"
        error={fieldErrors.email}
      />
      <FormField
        id="password"
        name="password"
        type="password"
        label="Password"
        autoComplete={passwordAutoComplete}
        error={fieldErrors.password}
      />
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60"
      >
        {pending ? pendingLabel : submitLabel}
      </button>
    </form>
  );
}
