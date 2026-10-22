import { hash, verify } from "@node-rs/argon2";

/**
 * argon2id with the library defaults (m=19 MiB, t=2, p=1), which match the
 * OWASP recommendation. The parameters are stored inside the hash string, so
 * they can be raised later without breaking existing passwords.
 */
export function hashPassword(password: string): Promise<string> {
  return hash(password);
}

export async function verifyPassword({
  hash: passwordHash,
  password,
}: {
  hash: string;
  password: string;
}): Promise<boolean> {
  try {
    return await verify(passwordHash, password);
  } catch {
    // A malformed stored hash must never let anyone in.
    return false;
  }
}
