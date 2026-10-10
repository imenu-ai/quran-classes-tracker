"use client";

import { useCallback, useEffect, useState } from "react";
import type { CreateMemberInput, Permission, Role, UpdateMemberInput } from "@/shared/access";
import type { FieldError } from "@/shared/schemas/errors";

/** A user of the center as the admin sees it (GET /api/center/users). */
export interface CenterUser {
  id: string;
  name: string;
  username: string;
  phone: string;
  role: Role;
  permissions: Permission[];
  classIds: string[];
  disabled: boolean;
  mustChangePassword: boolean;
}

/** Why an admin action failed: a server code, "OFFLINE", or "GENERIC". */
export type UsersErrorCode =
  | "INVALID_INPUT"
  | "USERNAME_TAKEN"
  | "LAST_ADMIN"
  | "CLASS_NOT_FOUND"
  | "NOT_FOUND"
  | "OFFLINE"
  | "GENERIC";

export type UsersResult<T> =
  { ok: true; value: T } | { ok: false; code: UsersErrorCode; errors: FieldError[] };

const KNOWN: readonly string[] = [
  "INVALID_INPUT",
  "USERNAME_TAKEN",
  "LAST_ADMIN",
  "CLASS_NOT_FOUND",
  "NOT_FOUND",
];

/** User management needs the server: these calls never queue offline. */
async function call<T>(url: string, init?: RequestInit): Promise<UsersResult<T>> {
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
    body.error && KNOWN.includes(body.error) ? (body.error as UsersErrorCode) : "GENERIC";
  return { ok: false, code, errors: body.errors ?? [] };
}

export const createUser = (input: CreateMemberInput) =>
  call<{ userId: string }>("/api/center/users", { method: "POST", body: JSON.stringify(input) });

export const updateUser = (id: string, input: UpdateMemberInput) =>
  call<{ ok: true }>(`/api/center/users/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });

export const setUserPassword = (id: string, password: string) =>
  call<{ ok: true }>(`/api/center/users/${encodeURIComponent(id)}/password`, {
    method: "POST",
    body: JSON.stringify({ password }),
  });

/** The center's users, loaded from the server; `reload` after a change. */
export function useCenterUsers() {
  const [state, setState] = useState<
    | { status: "loading" }
    | { status: "ready"; users: CenterUser[] }
    | { status: "error"; code: UsersErrorCode }
  >({ status: "loading" });

  const reload = useCallback(async () => {
    const result = await call<{ users: CenterUser[] }>("/api/center/users");
    setState(
      result.ok
        ? { status: "ready", users: result.value.users }
        : { status: "error", code: result.code },
    );
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { state, reload };
}
