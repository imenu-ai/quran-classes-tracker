"use client";

import type { UpdateCenterInput, UpdateProfileInput } from "@/shared/access";
import { apiCall } from "../api";

/** The signed-in user's own name, username, phone (and email for admins). */
export const updateProfile = (input: UpdateProfileInput) =>
  apiCall<{ ok: true }>("/api/account", { method: "PATCH", body: JSON.stringify(input) });

/** An admin renames the center or changes its time zone. */
export const updateCenterSettings = (input: UpdateCenterInput) =>
  apiCall<{ ok: true }>("/api/center", { method: "PATCH", body: JSON.stringify(input) });
