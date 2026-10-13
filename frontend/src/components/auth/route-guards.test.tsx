import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { describe, expect, it } from 'vitest';
import { AuthContext, type AuthContextValue, type AuthState } from '@/features/auth/auth-context';
import { ProtectedRoute } from './ProtectedRoute';
import { PublicOnlyRoute } from './PublicOnlyRoute';

const user = { id: 'u1', email: 'me@example.com', createdAt: '2026-01-01T00:00:00.000Z' };

function renderAt(
  state: AuthState,
  initialEntry: string | { pathname: string; state?: unknown },
  routes: ReactNode,
) {
  const value: AuthContextValue = {
    state,
    login: () => Promise.resolve(),
    register: () => Promise.resolve(),
    logout: () => Promise.resolve(),
  };
  return render(
    <AuthContext value={value}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>{routes}</Routes>
      </MemoryRouter>
    </AuthContext>,
  );
}

/** Prints where we ended up, so redirects can be asserted on. */
function Where({ label }: { label: string }) {
  const { pathname, state: locationState } = useLocation() as { pathname: string; state: unknown };
  const from = (locationState as { from?: { pathname: string } } | null)?.from?.pathname;
  return (
    <p>
      {label}
      {from ? ` (from ${from})` : ''} at {pathname}
    </p>
  );
}

const protectedRoutes = (
  <>
    <Route element={<ProtectedRoute />}>
      <Route path="/" element={<p>dashboard</p>} />
      <Route path="/reports" element={<p>reports</p>} />
    </Route>
    <Route path="/login" element={<Where label="login page" />} />
  </>
);

describe('ProtectedRoute', () => {
  it('shows a spinner, not the page or a redirect, while the session is being restored', () => {
    renderAt({ status: 'loading' }, '/', protectedRoutes);

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByText('dashboard')).not.toBeInTheDocument();
    expect(screen.queryByText(/login page/)).not.toBeInTheDocument();
  });

  it('sends a signed-out visitor to /login, remembering where they wanted to go', () => {
    renderAt({ status: 'unauthenticated' }, '/reports', protectedRoutes);

    expect(screen.getByText('login page (from /reports) at /login')).toBeInTheDocument();
    expect(screen.queryByText('reports')).not.toBeInTheDocument();
  });

  it('shows the page to a signed-in user', () => {
    renderAt({ status: 'authenticated', user }, '/reports', protectedRoutes);

    expect(screen.getByText('reports')).toBeInTheDocument();
  });
});

const publicRoutes = (
  <>
    <Route element={<PublicOnlyRoute />}>
      <Route path="/login" element={<p>login form</p>} />
    </Route>
    <Route path="/" element={<Where label="dashboard" />} />
    <Route path="/reports" element={<Where label="reports" />} />
  </>
);

describe('PublicOnlyRoute', () => {
  it('shows the login form to a signed-out visitor', () => {
    renderAt({ status: 'unauthenticated' }, '/login', publicRoutes);

    expect(screen.getByText('login form')).toBeInTheDocument();
  });

  it('waits with a spinner while the session is being restored', () => {
    renderAt({ status: 'loading' }, '/login', publicRoutes);

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByText('login form')).not.toBeInTheDocument();
  });

  it('sends a signed-in user to the dashboard', () => {
    renderAt({ status: 'authenticated', user }, '/login', publicRoutes);

    expect(screen.getByText('dashboard at /')).toBeInTheDocument();
  });

  it('sends a user who just logged in back to the page they were bounced from', () => {
    renderAt(
      { status: 'authenticated', user },
      { pathname: '/login', state: { from: { pathname: '/reports' } } },
      publicRoutes,
    );

    expect(screen.getByText('reports at /reports')).toBeInTheDocument();
  });
});
