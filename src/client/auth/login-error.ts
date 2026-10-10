export type LoginErrorKey =
  "invalidCredentials" | "accountDisabled" | "rateLimited" | "offline" | "generic";

/**
 * Maps a failed sign-in to the message key shown to the teacher. A network
 * failure (no HTTP status) or an offline device means sign-in needs internet.
 */
export function getLoginErrorKey(
  error: { status?: number | undefined; code?: string | undefined } | null | undefined,
  online: boolean,
): LoginErrorKey {
  if (!online || !error?.status) return "offline";
  if (error.status === 429) return "rateLimited";
  if (error.code === "ACCOUNT_DISABLED") return "accountDisabled";
  if (error.status === 401 || error.status === 422) return "invalidCredentials";
  return "generic";
}
