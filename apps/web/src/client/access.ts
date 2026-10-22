"use client";

import { useMemo } from "react";
import { can, canSeeClass, isAdmin, type Permission } from "@/shared/access";
import { useApp } from "./app-context";

/**
 * What the signed-in user may do, from the device's saved session. Only for
 * shaping the UI (hiding what he can't use): the server enforces access on
 * every sync, whatever the device shows.
 */
export function useAccess() {
  const { session } = useApp();
  const { role, permissions, classIds } = session;
  return useMemo(() => {
    const access = { role, permissions, classIds };
    return {
      isAdmin: isAdmin(access),
      can: (permission: Permission) => can(access, permission),
      canSeeClass: (classId: string) => canSeeClass(access, classId),
    };
  }, [role, permissions, classIds]);
}
