export interface AuthUser {
  id: string;
  email: string;
  createdAt: string;
}

/** Response of register, login and refresh. The refresh token itself only travels as a cookie. */
export interface AuthResponse {
  user: AuthUser;
  accessToken: string;
}
