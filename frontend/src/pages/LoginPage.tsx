import { Link } from 'react-router';
import { AuthFormLayout } from '@/components/auth/AuthFormLayout';
import { useAuth } from '@/features/auth/auth-context';
import { loginSchema } from '@/features/auth/auth-schemas';
import { CredentialsForm } from '@/features/auth/CredentialsForm';

export function LoginPage() {
  const { login } = useAuth();

  return (
    <AuthFormLayout
      title="Log in"
      footer={
        <>
          No account yet?{' '}
          <Link to="/register" className="font-medium text-accent-ink hover:underline">
            Create one
          </Link>
        </>
      }
    >
      <CredentialsForm
        schema={loginSchema}
        submitLabel="Log in"
        pendingLabel="Logging in…"
        passwordAutoComplete="current-password"
        onSubmit={login}
      />
    </AuthFormLayout>
  );
}
