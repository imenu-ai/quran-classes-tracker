export type LoginErrorKey = "invalidCredentials" | "rateLimited" | "offline" | "generic";

/**
 * Maps a failed sign-in to the message key shown to the teacher. A network
 * failure (no HTTP status) or an offline device means sign-in needs internet.
 */
export function getLoginErrorKey(
  error: { status?: number | undefined } | null | undefined,
  online: boolean,
): LoginErrorKey {
  if (!online || !error?.status) return "offline";
  if (error.status === 429) return "rateLimited";
  if (error.status === 401 || error.status === 422) return "invalidCredentials";
  return "generic";
}
