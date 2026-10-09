import { apiFetch } from '@/lib/api-client';
import type { AuthResponse, AuthUser } from './types';

interface Credentials {
  email: string;
  password: string;
}

// A 401 from these endpoints is a real answer, not an expired session: never refresh-and-retry.
const noRetry = { retryOnUnauthorized: false } as const;

export const registerRequest = (body: Credentials) =>
  apiFetch<AuthResponse>('/auth/register', { method: 'POST', body, ...noRetry });

export const loginRequest = (body: Credentials) =>
  apiFetch<AuthResponse>('/auth/login', { method: 'POST', body, ...noRetry });

export const logoutRequest = () => apiFetch<void>('/auth/logout', { method: 'POST', ...noRetry });

export const fetchCurrentUser = () => apiFetch<{ user: AuthUser }>('/auth/me');
