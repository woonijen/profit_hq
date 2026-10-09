/**
 * The access token lives only in memory (a module variable), never in localStorage, so an XSS
 * bug cannot read a long-lived credential. A page reload loses it; the httpOnly refresh cookie
 * is used to get a new one (see `refreshSession` in api-client.ts).
 */
let accessToken: string | null = null;

export const getAccessToken = (): string | null => accessToken;
export const setAccessToken = (token: string | null): void => {
  accessToken = token;
};
