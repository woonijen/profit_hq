import argon2 from 'argon2';

/** argon2id with the library defaults, which follow the current OWASP guidance. */
export function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, { type: argon2.argon2id });
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    // A malformed stored hash must not turn into a 500 that reveals the account exists.
    return false;
  }
}
