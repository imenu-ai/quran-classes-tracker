import { z } from "zod";
import { LOCALES } from "@/i18n/config";
import { idSchema, NAME_MAX } from "./schemas/base";

/**
 * Centers, roles and permissions. Shared by the server (which enforces them)
 * and the client (which only hides what a user can't do).
 */

export const ROLES = ["admin", "teacher"] as const;
export type Role = (typeof ROLES)[number];

export const PERMISSIONS = [
  /** Create, rename and archive classes. A class a teacher creates becomes his. */
  "classes.manage",
  /** Add, edit, move and archive students in his classes. */
  "students.manage",
  /** Lessons, attendance, evaluation and homework, including editing history. */
  "lessons.run",
  /** Student profile: monthly averages, chart and history. */
  "reports.view",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

/** What a signed-in user may do. Admins have every permission and every class. */
export interface Access {
  role: Role;
  permissions: readonly Permission[];
  classIds: readonly string[];
}

export const isAdmin = (access: Pick<Access, "role">) => access.role === "admin";

export function can(access: Pick<Access, "role" | "permissions">, permission: Permission): boolean {
  return isAdmin(access) || access.permissions.includes(permission);
}

export function canSeeClass(access: Pick<Access, "role" | "classIds">, classId: string): boolean {
  return isAdmin(access) || access.classIds.includes(classId);
}

// ---------------------------------------------------------------------------
// Usernames: unique inside a center. Better Auth stores "<code>:<local>".

export const CENTER_CODE_LENGTH = 6;
export const USERNAME_MIN = 3;
export const USERNAME_MAX = 30;
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;
export const PHONE_MAX = 20;

const CENTER_CODE_PATTERN = /^\d{6}$/;
const LOCAL_USERNAME_PATTERN = /^[a-z0-9_.]+$/;
const COMPOSITE_USERNAME_PATTERN = /^\d{6}:[a-z0-9_.]{3,30}$/;

export const isCenterCode = (value: string) => CENTER_CODE_PATTERN.test(value);
export const isLocalUsername = (value: string) =>
  value.length >= USERNAME_MIN &&
  value.length <= USERNAME_MAX &&
  LOCAL_USERNAME_PATTERN.test(value);
export const isCompositeUsername = (value: string) => COMPOSITE_USERNAME_PATTERN.test(value);

/** The username Better Auth stores and signs in with. */
export function composeUsername(centerCode: string, localUsername: string): string {
  return `${centerCode}:${localUsername.trim().toLowerCase()}`;
}

/** The part people see and type ("ahmad" from "482913:ahmad"). */
export function localUsernameOf(composite: string): string {
  const separator = composite.indexOf(":");
  return separator === -1 ? composite : composite.slice(separator + 1);
}

// ---------------------------------------------------------------------------
// Inputs (validated with parseWithCodes on both client and server).

const isTimeZone = (value: string) => Intl.supportedValuesOf("timeZone").includes(value);

export const centerCodeSchema = z.string().trim().regex(CENTER_CODE_PATTERN);
export const personNameSchema = z.string().trim().min(1).max(NAME_MAX);
export const localUsernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(USERNAME_MIN)
  .max(USERNAME_MAX)
  .regex(LOCAL_USERNAME_PATTERN);
export const passwordSchema = z.string().min(PASSWORD_MIN).max(PASSWORD_MAX);
/** Optional; "" when there is none. Digits, spaces and + ( ) - only. */
export const phoneSchema = z
  .string()
  .trim()
  .max(PHONE_MAX)
  .regex(/^[0-9+() -]*$/);
export const emailSchema = z.string().trim().toLowerCase().pipe(z.email());
export const timeZoneSchema = z.string().refine(isTimeZone, { error: "INVALID_VALUE" });

export const registerCenterSchema = z.object({
  centerName: z.string().trim().min(1).max(NAME_MAX),
  timezone: timeZoneSchema,
  adminName: personNameSchema,
  email: emailSchema,
  username: localUsernameSchema,
  password: passwordSchema,
  locale: z.enum(LOCALES).default("ar"),
});
export type RegisterCenterInput = z.input<typeof registerCenterSchema>;

const permissionsSchema = z.array(z.enum(PERMISSIONS)).transform((list) => [...new Set(list)]);
const classIdsSchema = z
  .array(idSchema)
  .max(500)
  .transform((list) => [...new Set(list)]);

export const createMemberSchema = z.object({
  name: personNameSchema,
  username: localUsernameSchema,
  phone: phoneSchema.default(""),
  password: passwordSchema,
  role: z.enum(ROLES).default("teacher"),
  permissions: permissionsSchema.default([]),
  classIds: classIdsSchema.default([]),
});
export type CreateMemberInput = z.input<typeof createMemberSchema>;

export const updateMemberSchema = z.object({
  name: personNameSchema.optional(),
  username: localUsernameSchema.optional(),
  phone: phoneSchema.optional(),
  role: z.enum(ROLES).optional(),
  permissions: permissionsSchema.optional(),
  classIds: classIdsSchema.optional(),
  disabled: z.boolean().optional(),
});
export type UpdateMemberInput = z.input<typeof updateMemberSchema>;

export const updateProfileSchema = z.object({
  name: personNameSchema.optional(),
  username: localUsernameSchema.optional(),
  phone: phoneSchema.optional(),
  /** Admins only (used for password reset). */
  email: emailSchema.optional(),
});
export type UpdateProfileInput = z.input<typeof updateProfileSchema>;

export const updateCenterSchema = z.object({
  name: z.string().trim().min(1).max(NAME_MAX).optional(),
  timezone: timeZoneSchema.optional(),
});
export type UpdateCenterInput = z.input<typeof updateCenterSchema>;
