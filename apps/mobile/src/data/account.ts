import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import type { ApiErrorCode } from "@qct/core/shared/api";
import type {
  CreateMemberInput,
  UpdateCenterInput,
  UpdateMemberInput,
  UpdateProfileInput,
} from "@qct/core/shared/access";
import type { CenterUser } from "@qct/core/shared/center-users";
import { apiCall } from "@/auth/api";

// The account and center routes the web's client/data/account.ts and
// users.ts call: online only, the server checks everything.

/** The signed-in user's own name, username, phone (and email for admins). */
export const updateProfile = (input: UpdateProfileInput) =>
  apiCall<{ ok: true }>("/api/account", { method: "PATCH", body: JSON.stringify(input) });

/** An admin renames the center or changes its time zone. */
export const updateCenterSettings = (input: UpdateCenterInput) =>
  apiCall<{ ok: true }>("/api/center", { method: "PATCH", body: JSON.stringify(input) });

export const createUser = (input: CreateMemberInput) =>
  apiCall<{ userId: string }>("/api/center/users", {
    method: "POST",
    body: JSON.stringify(input),
  });

export const updateUser = (id: string, input: UpdateMemberInput) =>
  apiCall<{ ok: true }>(`/api/center/users/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });

export const setUserPassword = (id: string, password: string) =>
  apiCall<{ ok: true }>(`/api/center/users/${encodeURIComponent(id)}/password`, {
    method: "POST",
    body: JSON.stringify({ password }),
  });

export type CenterUsersState =
  | { status: "loading" }
  | { status: "ready"; users: CenterUser[] }
  | { status: "error"; code: ApiErrorCode };

/**
 * The center's users, from the server. Loaded again each time the screen
 * comes into view, so the list shows what was just saved elsewhere.
 */
export function useCenterUsers() {
  const [state, setState] = useState<CenterUsersState>({ status: "loading" });
  const reload = useCallback(async () => {
    const result = await apiCall<{ users: CenterUser[] }>("/api/center/users");
    setState(
      result.ok
        ? { status: "ready", users: result.value.users }
        : { status: "error", code: result.code },
    );
  }, []);
  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );
  return { state, reload };
}
