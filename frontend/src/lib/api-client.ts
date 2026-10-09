import { env } from '@/config/env';

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

/**
 * Thin typed wrapper around fetch. Always sends cookies (`credentials: 'include'`)
 * so the refresh-token cookie works, and throws `ApiError` on non-2xx responses.
 * Network failures surface as ApiError with status 0.
 */
export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, query, signal } = options;

  let response: Response;
  try {
    response = await fetch(buildUrl(path, query), {
      method,
      credentials: 'include',
      signal,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
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
