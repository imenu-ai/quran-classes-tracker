import type { FieldError } from "./schemas/errors";

/**
 * Why an account or center call failed: a server code, "OFFLINE" (no
 * connection) or "GENERIC" (anything else). These calls need the server;
 * unlike lesson data, nothing is queued for later. Shared by the web and the
 * app, which each make the request their own way.
 */
export type ApiErrorCode =
  | "INVALID_INPUT"
  | "USERNAME_TAKEN"
  | "EMAIL_TAKEN"
  | "LAST_ADMIN"
  | "CLASS_NOT_FOUND"
  | "NOT_FOUND"
  | "FORBIDDEN"
  | "OFFLINE"
  | "GENERIC";

export type ApiResult<T> =
  { ok: true; value: T } | { ok: false; code: ApiErrorCode; errors: FieldError[] };

const SERVER_CODES: readonly string[] = [
  "INVALID_INPUT",
  "USERNAME_TAKEN",
  "EMAIL_TAKEN",
  "LAST_ADMIN",
  "CLASS_NOT_FOUND",
  "NOT_FOUND",
  "FORBIDDEN",
];

/** The result of a response the server answered, from its status and JSON body. */
export function apiResult<T>(ok: boolean, body: unknown): ApiResult<T> {
  if (ok) return { ok: true, value: body as T };
  const { error, errors } = (body ?? {}) as { error?: string; errors?: FieldError[] };
  const code = error && SERVER_CODES.includes(error) ? (error as ApiErrorCode) : "GENERIC";
  return { ok: false, code, errors: errors ?? [] };
}
