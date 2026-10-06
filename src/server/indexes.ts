import type { Db, IndexDescription } from "mongodb";
import { COLLECTIONS } from "./collections";

/** Every index the app relies on. Safe to apply repeatedly. */
export const INDEXES: Record<string, IndexDescription[]> = {
  [COLLECTIONS.tenants]: [{ key: { name: 1 }, name: "name_unique", unique: true }],
  [COLLECTIONS.users]: [
    { key: { username: 1 }, name: "username_unique", unique: true },
    { key: { email: 1 }, name: "email_unique", unique: true },
    { key: { tenantId: 1 }, name: "tenantId" },
  ],
  [COLLECTIONS.authSessions]: [
    { key: { token: 1 }, name: "token_unique", unique: true },
    { key: { userId: 1 }, name: "userId" },
    // Mongo removes a session once its expiresAt has passed.
    { key: { expiresAt: 1 }, name: "expiresAt_ttl", expireAfterSeconds: 0 },
  ],
  [COLLECTIONS.authAccounts]: [
    { key: { userId: 1 }, name: "userId" },
    { key: { providerId: 1, accountId: 1 }, name: "provider_account" },
  ],
  [COLLECTIONS.rateLimits]: [{ key: { key: 1 }, name: "key_unique", unique: true }],
  [COLLECTIONS.classes]: [{ key: { tenantId: 1, serverVersion: 1 }, name: "tenant_version" }],
  [COLLECTIONS.students]: [
    { key: { tenantId: 1, serverVersion: 1 }, name: "tenant_version" },
    { key: { tenantId: 1, classId: 1 }, name: "tenant_class" },
  ],
  [COLLECTIONS.lessons]: [
    { key: { tenantId: 1, serverVersion: 1 }, name: "tenant_version" },
    { key: { tenantId: 1, classId: 1, date: 1 }, name: "tenant_class_date" },
  ],
  [COLLECTIONS.attendance]: [
    { key: { tenantId: 1, serverVersion: 1 }, name: "tenant_version" },
    { key: { tenantId: 1, lessonId: 1 }, name: "tenant_lesson" },
    { key: { tenantId: 1, studentId: 1 }, name: "tenant_student" },
  ],
  [COLLECTIONS.homework]: [
    { key: { tenantId: 1, serverVersion: 1 }, name: "tenant_version" },
    { key: { tenantId: 1, studentId: 1 }, name: "tenant_student" },
    { key: { tenantId: 1, evaluatedLessonId: 1 }, name: "tenant_evaluated_lesson" },
  ],
};

/** Creates any missing index. Existing identical indexes are left as they are. */
export async function ensureIndexes(db: Db): Promise<void> {
  for (const [collection, indexes] of Object.entries(INDEXES)) {
    await db.collection(collection).createIndexes(indexes);
  }
}
