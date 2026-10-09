export const env = {
  /** Base URL for API calls, without a trailing slash. */
  apiBaseUrl: (import.meta.env.VITE_API_BASE_URL ?? '/api').replace(/\/+$/, ''),
} as const;
