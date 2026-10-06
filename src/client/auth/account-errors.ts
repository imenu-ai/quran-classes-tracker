export type AccountErrorKey =
  | "offline"
  | "usernameTaken"
  | "invalidUsername"
  | "wrongPassword"
  | "passwordLength"
  | "rateLimited"
  | "sessionExpired"
  | "generic";

/**
 * Maps a failed profile / password change (Better Auth error) to the
 * message shown in settings. These changes need the server, so a missing
 * response or an offline device means "needs internet".
 */
export function getAccountErrorKey(
  error: { status?: number | undefined; code?: string | undefined } | null | undefined,
  online: boolean,
): AccountErrorKey {
  if (!online || !error?.status) return "offline";
  if (error.status === 429) return "rateLimited";
  if (error.status === 401 && error.code !== "INVALID_PASSWORD") return "sessionExpired";
  switch (error.code) {
    case "USERNAME_IS_ALREADY_TAKEN":
      return "usernameTaken";
    case "INVALID_USERNAME":
    case "USERNAME_TOO_SHORT":
    case "USERNAME_TOO_LONG":
      return "invalidUsername";
    case "INVALID_PASSWORD":
      return "wrongPassword";
    case "PASSWORD_TOO_SHORT":
    case "PASSWORD_TOO_LONG":
      return "passwordLength";
    default:
      return "generic";
  }
}
