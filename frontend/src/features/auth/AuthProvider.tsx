import { useQueryClient } from '@tanstack/react-query';
import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { onSessionExpired, refreshSession } from '@/lib/api-client';
import { setAccessToken } from '@/lib/auth-token';
import { loginRequest, logoutRequest, registerRequest } from './auth-api';
import { AuthContext, type AuthContextValue, type AuthState } from './auth-context';
import type { AuthResponse } from './types';

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<AuthState>({ status: 'loading' });

  const startSession = useCallback((session: AuthResponse) => {
    setAccessToken(session.accessToken);
    setState({ status: 'authenticated', user: session.user });
  }, []);

  const endSession = useCallback(() => {
    setAccessToken(null);
    // Cached data belongs to the previous user.
    queryClient.clear();
    setState({ status: 'unauthenticated' });
  }, [queryClient]);

  // Silent login on page load: the access token is memory-only, the refresh cookie survives.
  useEffect(() => {
    let cancelled = false;
    refreshSession().then(
      (session) => {
        if (!cancelled) startSession(session);
      },
      () => {
        if (!cancelled) setState({ status: 'unauthenticated' });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [startSession]);

  // A rejected refresh anywhere in the app (see apiFetch) means the session is gone.
  useEffect(() => onSessionExpired(endSession), [endSession]);

  const value = useMemo<AuthContextValue>(
    () => ({
      state,
      login: async (credentials) => startSession(await loginRequest(credentials)),
      register: async (credentials) => startSession(await registerRequest(credentials)),
      logout: async () => {
        try {
          await logoutRequest();
        } catch {
          // Even if the server is unreachable, drop the local session.
        }
        endSession();
      },
    }),
    [state, startSession, endSession],
  );

  return <AuthContext value={value}>{children}</AuthContext>;
}
