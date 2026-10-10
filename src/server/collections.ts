/** MongoDB collection names, in one place. */
export const COLLECTIONS = {
  tenants: "tenants",
  /** Roles, permissions and assigned classes per user (Phase 8). */
  members: "members",
  counters: "counters",
  // Better Auth models (renamed in src/server/auth/auth.ts).
  users: "users",
  authSessions: "auth_sessions",
  authAccounts: "auth_accounts",
  authVerifications: "auth_verifications",
  rateLimits: "rate_limits",
  // Syncable, tenant-scoped records.
  classes: "classes",
  students: "students",
  lessons: "lessons",
  attendance: "attendance",
  homework: "homework",
} as const;

export const SYNCABLE_COLLECTIONS = [
  COLLECTIONS.classes,
  COLLECTIONS.students,
  COLLECTIONS.lessons,
  COLLECTIONS.attendance,
  COLLECTIONS.homework,
] as const;

export type SyncableCollection = (typeof SYNCABLE_COLLECTIONS)[number];
