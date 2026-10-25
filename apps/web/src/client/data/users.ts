"use client";

import { useCallback, useEffect, useState } from "react";
import type { CreateMemberInput, UpdateMemberInput } from "@qct/core/shared/access";
import type { CenterUser } from "@qct/core/shared/center-users";
import { apiCall, type ApiErrorCode } from "../api";

export type { CenterUser } from "@qct/core/shared/center-users";

/** Why an admin action failed (see ApiErrorCode). */
export type UsersErrorCode = ApiErrorCode;

const call = apiCall;

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
