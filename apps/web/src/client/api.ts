"use client";

import { apiResult, type ApiResult } from "@qct/core/shared/api";

export type { ApiErrorCode, ApiResult } from "@qct/core/shared/api";

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
  const body: unknown = await response.json().catch(() => ({}));
  return apiResult<T>(response.ok, body);
}
