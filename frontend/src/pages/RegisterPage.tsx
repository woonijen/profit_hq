import { Link } from 'react-router';
import { AuthFormLayout } from '@/components/auth/AuthFormLayout';
import { useAuth } from '@/features/auth/auth-context';
import { registerSchema } from '@/features/auth/auth-schemas';
import { CredentialsForm } from '@/features/auth/CredentialsForm';

export function RegisterPage() {
  const { register } = useAuth();

  return (
    <AuthFormLayout
      title="Create your account"
      footer={
        <>
          Already registered?{' '}
          <Link to="/login" className="font-medium text-accent-ink hover:underline">
            Log in
          </Link>
        </>
      }
    >
      <CredentialsForm
        schema={registerSchema}
        submitLabel="Create account"
        pendingLabel="Creating account…"
        passwordAutoComplete="new-password"
        onSubmit={register}
      />
    </AuthFormLayout>
  );
}
