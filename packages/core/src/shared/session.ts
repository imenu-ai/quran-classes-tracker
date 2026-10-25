import { z } from "zod";
import { LOCALES, type Locale } from "../i18n/config";
import { PERMISSIONS, ROLES, type Permission, type Role } from "./access";

/** GET /api/me: who is signed in, what he may do, and his center's settings. */
export const meResponseSchema = z.object({
  user: z.object({
    id: z.string(),
    name: z.string(),
    /** The part people type ("ahmad"), not the stored "<code>:ahmad". */
    username: z.string(),
    phone: z.string(),
    /** Admins only (used for password reset); null for teachers. */
    email: z.string().nullable(),
    locale: z.enum(LOCALES),
    role: z.enum(ROLES),
    permissions: z.array(z.enum(PERMISSIONS)),
    classIds: z.array(z.string()),
    mustChangePassword: z.boolean(),
    accessVersion: z.number().int(),
  }),
  tenant: z.object({
    id: z.string(),
    name: z.string(),
    code: z.string(),
    timezone: z.string(),
  }),
});

export type MeResponse = z.infer<typeof meResponseSchema>;

/**
 * What the device remembers about the signed-in user. This is what keeps the
 * app usable offline: the client gate checks it, not the server. Access here
 * only shapes the UI; the server enforces it on every sync.
 */
export interface SessionSnapshot {
  userId: string;
  tenantId: string;
  name: string;
  username: string;
  phone: string;
  /** Admins only. */
  email: string | null;
  locale: Locale;
  role: Role;
  permissions: Permission[];
  classIds: string[];
  mustChangePassword: boolean;
  accessVersion: number;
  tenantName: string;
  centerCode: string;
  timezone: string;
  savedAt: number;
}

export function snapshotFromMe(me: MeResponse, now: number): SessionSnapshot {
  return {
    userId: me.user.id,
    tenantId: me.tenant.id,
    name: me.user.name,
    username: me.user.username,
    phone: me.user.phone,
    email: me.user.email,
    locale: me.user.locale,
    role: me.user.role,
    permissions: me.user.permissions,
    classIds: me.user.classIds,
    mustChangePassword: me.user.mustChangePassword,
    accessVersion: me.user.accessVersion,
    tenantName: me.tenant.name,
    centerCode: me.tenant.code,
    timezone: me.tenant.timezone,
    savedAt: now,
  };
}

/** A stored snapshot, or null when it isn't one (e.g. saved before centers and roles). */
export function asSessionSnapshot(value: unknown): SessionSnapshot | null {
  const snapshot = value as Partial<SessionSnapshot> | null | undefined;
  if (!snapshot?.role || !snapshot.centerCode) return null;
  return snapshot as SessionSnapshot;
}
