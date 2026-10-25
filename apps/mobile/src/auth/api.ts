import { apiResult, type ApiResult } from "@qct/core/shared/api";
import { deviceIsOnline } from "@/sync/device";
import { apiFetch } from "./client";

/**
 * A JSON call to one of the server's account or center routes, with the
 * session cookie (the web's apiCall). These need a connection; nothing is
 * queued for later.
 */
export async function apiCall<T>(path: string, init?: RequestInit): Promise<ApiResult<T>> {
  let response: Response;
  try {
    response = await apiFetch(path, {
      ...init,
      headers: { "content-type": "application/json", accept: "application/json" },
    });
  } catch {
    return { ok: false, code: deviceIsOnline() ? "GENERIC" : "OFFLINE", errors: [] };
  }
  const body: unknown = await response.json().catch(() => ({}));
  return apiResult<T>(response.ok, body);
}
