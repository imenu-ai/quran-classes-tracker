"use client";

import type { FieldError } from "@/shared/schemas/errors";

/**
 * Why an account or center call failed: a server code, "OFFLINE" (no
 * connection) or "GENERIC" (anything else). These calls need the server;
 * unlike lesson data, nothing is queued for later.
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

/** A JSON call to one of the app's account or center routes. */
export async function apiCall<T>(url: string, init?: RequestInit): Promise<ApiResult<T>> {
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers: { "content-type": "application/json", accept: "application/json" },
    });
  } catch {
    return { ok: false, code: navigator.onLine ? "GENERIC" : "OFFLINE", errors: [] };
  }
  const body = (await response.json().catch(() => ({}))) as {
    error?: string;
    errors?: FieldError[];
  };
  if (response.ok) return { ok: true, value: body as T };
  const code =
    body.error && SERVER_CODES.includes(body.error) ? (body.error as ApiErrorCode) : "GENERIC";
  return { ok: false, code, errors: body.errors ?? [] };
}
