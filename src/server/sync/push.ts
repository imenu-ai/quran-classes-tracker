import type { Db, Filter } from "mongodb";
import { can, canSeeClass, isAdmin, type Permission } from "@/shared/access";
import { parseWithCodes } from "@/shared/schemas/errors";
import { clampUpdatedAt } from "@/shared/sync/lww";
import type { PushMutation, PushResult } from "@/shared/sync/protocol";
import { RECORD_SCHEMAS, REFERENCES, type SyncRecord, type SyncTable } from "@/shared/sync/tables";
import { actorOf, tenantIdOf, type Actor, type SyncScope } from "../actor";
import { membersCollection } from "../members";
import {
  createTenantRepositories,
  type TenantDocument,
  type TenantRepositories,
} from "../repositories/tenant-repository";
import { allocateVersions } from "./versions";

interface ValidMutation {
  table: SyncTable;
  record: SyncRecord;
}

/** The permission a teacher needs to write each table. */
const TABLE_PERMISSION: Record<SyncTable, Permission> = {
  classes: "classes.manage",
  students: "students.manage",
  lessons: "lessons.run",
  attendance: "lessons.run",
  homework: "lessons.run",
};

const recordIdOf = (record: Record<string, unknown>) =>
  typeof record.id === "string" ? record.id : "";

const field = (record: object, name: string): string | undefined => {
  const value = (record as Record<string, unknown>)[name];
  return typeof value === "string" ? value : undefined;
};

/** Stored shape: the record without `id` (it becomes `_id`). */
function toDocumentFields(record: SyncRecord, serverVersion: number, updatedAt: number) {
  const { id: _id, tenantId: _tenantId, ...fields } = record;
  return { ...fields, updatedAt, serverVersion };
}

/** Matches a stored copy that the incoming write beats (see isNewer in shared/sync/lww). */
function olderThan(updatedAt: number, updatedBy: string): Filter<TenantDocument> {
  return {
    $or: [{ updatedAt: { $lt: updatedAt } }, { updatedAt, updatedBy: { $lt: updatedBy } }],
  };
}

async function findMissingReference(
  repos: TenantRepositories,
  table: SyncTable,
  record: SyncRecord,
): Promise<{ field: string } | null> {
  for (const reference of REFERENCES[table]) {
    const value = (record as unknown as Record<string, unknown>)[reference.field];
    if (value === null || value === undefined) continue;
    // Soft-deleted parents still count: history must stay linkable.
    const exists = await repos[reference.table].countDocuments(
      { _id: String(value) },
      { limit: 1 },
    );
    if (!exists) return { field: reference.field };
  }
  return null;
}

/**
 * Rules that hold for everyone: an attendance record belongs to its lesson's
 * class, and lessons and attendance never move to another class.
 */
async function checkConsistency(
  repos: TenantRepositories,
  table: SyncTable,
  record: SyncRecord,
  existing: TenantDocument | null,
): Promise<{ field: string } | null> {
  if (table === "attendance") {
    const lesson = await repos.lessons.findById(field(record, "lessonId") ?? "");
    if (lesson && lesson.classId !== field(record, "classId")) return { field: "classId" };
  }
  if ((table === "lessons" || table === "attendance") && existing) {
    if (existing.classId !== field(record, "classId")) return { field: "classId" };
  }
  return null;
}

/** The classes a write touches: its class now and, for a move, its class before. */
async function classesTouched(
  repos: TenantRepositories,
  table: SyncTable,
  record: SyncRecord,
  existing: TenantDocument | null,
): Promise<string[]> {
  if (table === "classes") return existing ? [record.id] : [];
  if (table === "homework") {
    const studentIds = new Set([field(record, "studentId"), field(existing ?? {}, "studentId")]);
    const classIds: string[] = [];
    for (const studentId of studentIds) {
      if (!studentId) continue;
      const student = await repos.students.findById(studentId);
      if (student) classIds.push(String(student.classId));
    }
    return classIds;
  }
  return [field(record, "classId"), field(existing ?? {}, "classId")].filter(
    (value): value is string => value !== undefined,
  );
}

/**
 * Whether a teacher may make this write: the table's permission, and every
 * class it touches assigned to him. A new class needs only the permission.
 */
async function isAllowed(
  repos: TenantRepositories,
  actor: Actor,
  table: SyncTable,
  record: SyncRecord,
  existing: TenantDocument | null,
): Promise<boolean> {
  if (isAdmin(actor.access)) return true;
  if (!can(actor.access, TABLE_PERMISSION[table])) return false;
  const classIds = await classesTouched(repos, table, record, existing);
  if (table !== "classes" && classIds.length === 0) return false;
  return classIds.every((classId) => canSeeClass(actor.access, classId));
}

/**
 * Applies a batch of client mutations for one tenant, in order.
 *
 * For each record: validate with the shared schema (including sura/ayah
 * rules), force the session's tenant, check references exist in this tenant
 * (parents earlier in the same batch count, since they're written first),
 * check the user may make the write (FORBIDDEN otherwise), clamp the device
 * clock, and write only if the incoming copy is newer.
 */
export async function pushChanges(
  db: Db,
  scope: SyncScope,
  mutations: readonly PushMutation[],
  now: number = Date.now(),
): Promise<PushResult[]> {
  const tenantId = tenantIdOf(scope);
  const given = actorOf(scope);
  // A copy: classes this teacher creates are his for the rest of the batch.
  const actor = given && {
    ...given,
    access: { ...given.access, classIds: [...given.access.classIds] },
  };
  const repos = createTenantRepositories(db, tenantId);
  const results: PushResult[] = new Array(mutations.length);
  const valid: { index: number; mutation: ValidMutation }[] = [];

  mutations.forEach((mutation, index) => {
    const id = recordIdOf(mutation.record);
    // The client's tenantId is never trusted: the session decides.
    const parsed = parseWithCodes(RECORD_SCHEMAS[mutation.table], { ...mutation.record, tenantId });
    if (!parsed.success) {
      const [first] = parsed.errors;
      results[index] = {
        id,
        table: mutation.table,
        status: "rejected",
        code: first?.code ?? "INVALID",
        params: { ...first?.params, field: first?.path ?? "" },
      };
      return;
    }
    valid.push({ index, mutation: { table: mutation.table, record: parsed.data as SyncRecord } });
  });

  if (valid.length === 0) return results;

  const allocation = await allocateVersions(db, tenantId, valid.length);
  try {
    for (const [offset, { index, mutation }] of valid.entries()) {
      results[index] = await applyOne(db, repos, actor, mutation, allocation.from + offset, now);
    }
  } finally {
    await allocation.release();
  }
  return results;
}

async function applyOne(
  db: Db,
  repos: TenantRepositories,
  actor: Actor | null,
  { table, record }: ValidMutation,
  serverVersion: number,
  now: number,
): Promise<PushResult> {
  const base = { id: record.id, table };
  const repo = repos[table];

  // Refuse an id that another tenant already uses, without touching it.
  if (await repo.existsInOtherTenant(record.id)) {
    return { ...base, status: "rejected", code: "FORBIDDEN" };
  }

  const missing = await findMissingReference(repos, table, record);
  if (missing) {
    return { ...base, status: "rejected", code: "REFERENCE_NOT_FOUND", params: missing };
  }

  const existing = await repo.findById(record.id);
  const inconsistent = await checkConsistency(repos, table, record, existing);
  if (inconsistent) {
    return { ...base, status: "rejected", code: "INVALID_VALUE", params: inconsistent };
  }

  if (actor && !(await isAllowed(repos, actor, table, record, existing))) {
    return { ...base, status: "rejected", code: "FORBIDDEN" };
  }

  const updatedAt = clampUpdatedAt(record.updatedAt, now);
  const outcome = await repo.upsertWhere(
    record.id,
    olderThan(updatedAt, record.updatedBy),
    toDocumentFields(record, serverVersion, updatedAt),
  );
  // The id exists in this tenant and is at least as new: nothing to do.
  if (outcome !== "written") return { ...base, status: "stale" };

  // A class a teacher creates is assigned to him.
  if (table === "classes" && !existing && actor && !isAdmin(actor.access)) {
    await membersCollection(db).updateOne(
      { _id: actor.userId, tenantId: repos.classes.tenantId },
      { $addToSet: { classIds: record.id }, $set: { updatedAt: new Date() } },
    );
    actor.access.classIds = [...actor.access.classIds, record.id];
  }

  const movedFrom = field(existing ?? {}, "classId");
  if (table === "students" && existing && movedFrom !== field(record, "classId")) {
    await onStudentMoved(db, repos, record.id, movedFrom, field(record, "classId"));
  }

  return { ...base, status: "applied", serverVersion };
}

/**
 * A student changed class. Teachers only pull a student's homework while
 * he's in one of their classes, so:
 * - his homework gets new versions: a teacher gaining him pulls his history;
 * - teachers who lose sight of him get a new accessVersion: their devices
 *   resync and drop him.
 */
async function onStudentMoved(
  db: Db,
  repos: TenantRepositories,
  studentId: string,
  from: string | undefined,
  to: string | undefined,
) {
  const homework = await repos.homework.find({ studentId }, { projection: { _id: 1 } }).toArray();
  if (homework.length > 0) {
    const allocation = await allocateVersions(db, repos.homework.tenantId, homework.length);
    try {
      for (const [offset, doc] of homework.entries()) {
        await repos.homework.updateOne(
          { _id: doc._id },
          { $set: { serverVersion: allocation.from + offset } },
        );
      }
    } finally {
      await allocation.release();
    }
  }

  if (from) {
    await membersCollection(db).updateMany(
      {
        tenantId: repos.students.tenantId,
        role: "teacher",
        classIds: { $in: [from], ...(to ? { $nin: [to] } : {}) },
      },
      { $inc: { accessVersion: 1 }, $set: { updatedAt: new Date() } },
    );
  }
}
