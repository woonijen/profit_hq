import { Navigate, Outlet, useLocation } from 'react-router';
import { useAuth } from '@/features/auth/auth-context';
import { FullPageSpinner } from './FullPageSpinner';

/** Login/register pages: signed-in users go back to where they came from, or the dashboard. */
export function PublicOnlyRoute() {
  const { state } = useAuth();
  const location = useLocation();

  if (state.status === 'loading') return <FullPageSpinner />;
  if (state.status === 'authenticated') {
    const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname;
    return <Navigate to={from ?? '/'} replace />;
  }
  return <Outlet />;
}
