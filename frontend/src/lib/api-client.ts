import { env } from '@/config/env';
import type { AuthResponse } from '@/features/auth/types';
import { getAccessToken, setAccessToken } from '@/lib/auth-token';

/** Mirrors the backend error envelope: `{ error: { code, message, details?, requestId } }`. */
interface ApiErrorBody {
  error?: { code?: string; message?: string; details?: unknown; requestId?: string };
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
    readonly requestId?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type QueryValue = string | number | boolean | null | undefined;

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Record<string, QueryValue>;
  signal?: AbortSignal;
  /**
   * On a 401, refresh the session and retry once. Defaults to true; the auth endpoints
   * (login, register, refresh, logout) turn it off because a 401 there is a real answer.
   */
  retryOnUnauthorized?: boolean;
}

function buildUrl(path: string, query?: RequestOptions['query']): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null) params.set(key, String(value));
  }
  const search = params.toString();
  return `${env.apiBaseUrl}${path}${search ? `?${search}` : ''}`;
}

async function toApiError(response: Response): Promise<ApiError> {
  const body = (await response.json().catch(() => null)) as ApiErrorBody | null;
  const error = body?.error;
  return new ApiError(
    response.status,
    error?.code ?? 'UNKNOWN_ERROR',
    error?.message ?? response.statusText ?? 'Request failed',
    error?.details,
    error?.requestId,
  );
}

/** One request, no refresh handling. Sends cookies and the current access token. */
async function request<T>(path: string, options: RequestOptions): Promise<T> {
  const { method = 'GET', body, query, signal } = options;

  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const token = getAccessToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let response: Response;
  try {
    response = await fetch(buildUrl(path, query), {
      method,
      credentials: 'include',
      signal,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === 'AbortError') throw cause;
    throw new ApiError(0, 'NETWORK_ERROR', 'Unable to reach the server');
  }

  if (!response.ok) throw await toApiError(response);
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

const REFRESH_LOCK_NAME = 'profithq-auth-refresh';

let refreshInFlight: Promise<AuthResponse> | null = null;

async function performRefresh(): Promise<AuthResponse> {
  const session = await request<AuthResponse>('/auth/refresh', { method: 'POST' });
  setAccessToken(session.accessToken);
  return session;
}

/**
 * Exchanges the refresh cookie for a new access token.
 *
 * Refresh tokens rotate, and replaying a rotated one revokes the whole session, so two refreshes
 * must never run at once. Within a tab, concurrent callers (several 401s, React StrictMode's
 * double effect) share one request. Across tabs, a Web Lock serialises them, so the second tab
 * sends the cookie the first tab just received.
 */
export function refreshSession(): Promise<AuthResponse> {
  refreshInFlight ??= (
    'locks' in navigator
      ? navigator.locks.request(REFRESH_LOCK_NAME, performRefresh)
      : performRefresh()
  ).finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

type SessionExpiredListener = () => void;
const sessionExpiredListeners = new Set<SessionExpiredListener>();

/** Called when a refresh is rejected, i.e. the user must log in again. Returns an unsubscribe. */
export function onSessionExpired(listener: SessionExpiredListener): () => void {
  sessionExpiredListeners.add(listener);
  return () => sessionExpiredListeners.delete(listener);
}

/**
 * Thin typed wrapper around fetch. Always sends cookies (`credentials: 'include'`) and the
 * access token, silently refreshes an expired session once on 401, and throws `ApiError` on
 * non-2xx responses. Network failures surface as ApiError with status 0.
 */
export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  try {
    return await request<T>(path, options);
  } catch (error) {
    if (
      !(error instanceof ApiError) ||
      error.status !== 401 ||
      options.retryOnUnauthorized === false
    ) {
      throw error;
    }

    try {
      await refreshSession();
    } catch (refreshError) {
      // Only a rejected refresh ends the session; a network blip should not log the user out.
      if (refreshError instanceof ApiError && refreshError.status === 401) {
        setAccessToken(null);
        sessionExpiredListeners.forEach((listener) => listener());
      }
      throw error;
    }
    return request<T>(path, options);
  }
}
