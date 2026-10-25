"use client";

import type { UpdateCenterInput, UpdateProfileInput } from "@qct/core/shared/access";
import { apiCall } from "../api";

/** The signed-in user's own name, username, phone (and email for admins). */
export const updateProfile = (input: UpdateProfileInput) =>
  apiCall<{ ok: true }>("/api/account", { method: "PATCH", body: JSON.stringify(input) });

/** An admin renames the center or changes its time zone. */
export const updateCenterSettings = (input: UpdateCenterInput) =>
  apiCall<{ ok: true }>("/api/center", { method: "PATCH", body: JSON.stringify(input) });

/** The user deletes his own account, confirmed with his password (PLAN.md §0 #50). */
export const deleteOwnAccount = (password: string) =>
  apiCall<{ ok: true }>("/api/account", { method: "DELETE", body: JSON.stringify({ password }) });

/** An admin deletes the center with all its users and records. */
export const deleteCenter = (password: string) =>
  apiCall<{ ok: true }>("/api/center", { method: "DELETE", body: JSON.stringify({ password }) });
