import type { ClassRecord } from "../../shared/schemas/class";
import type { StudentRecord } from "../../shared/schemas/student";
import type { DataWriter } from "../local-store";
import type { StorageReader } from "../storage";

/** Not deleted and not archived. */
export const isActive = (record: { deletedAt: number | null; archivedAt?: number | null }) =>
  record.deletedAt === null && !record.archivedAt;

export const isArchived = (record: { deletedAt: number | null; archivedAt: number | null }) =>
  record.deletedAt === null && record.archivedAt !== null;

export interface ClassSummary {
  record: ClassRecord;
  studentCount: number;
}

/** Active classes sorted by name, with their active student count. */
export function summarizeClasses(
  classes: readonly ClassRecord[],
  students: readonly StudentRecord[],
  locale: string,
): ClassSummary[] {
  const counts = new Map<string, number>();
  for (const student of students) {
    if (isActive(student)) counts.set(student.classId, (counts.get(student.classId) ?? 0) + 1);
  }
  const collator = new Intl.Collator(locale);
  return classes
    .filter(isActive)
    .sort((a, b) => collator.compare(a.name, b.name))
    .map((record) => ({
      record,
      studentCount: counts.get(record.id) ?? 0,
    }));
}

// ---------------------------------------------------------------------------
// Queries.

/** Home screen data: active class summaries and archived classes. */
export async function loadClassList(db: StorageReader, locale: string) {
  const [classes, students] = await Promise.all([db.all("classes"), db.all("students")]);
  const collator = new Intl.Collator(locale);
  return {
    active: summarizeClasses(classes, students, locale),
    archived: classes.filter(isArchived).sort((a, b) => collator.compare(a.name, b.name)),
  };
}

/** Every active class, by name (for "move to" pickers). */
export async function loadActiveClasses(db: StorageReader, locale: string) {
  const collator = new Intl.Collator(locale);
  return (await db.all("classes"))
    .filter(isActive)
    .sort((a, b) => collator.compare(a.name, b.name));
}

/** The class, or null when it doesn't exist. */
export async function loadClass(db: StorageReader, id: string) {
  return (await db.get("classes", id)) ?? null;
}

export async function activeStudentsOf(db: StorageReader, classId: string) {
  return (await db.query("students", "classId", { equals: classId })).filter(isActive);
}

// ---------------------------------------------------------------------------
// Actions. Multi-record actions run in one transaction: all or nothing.

export function createClass(store: DataWriter, name: string) {
  return store.create("classes", { name, archivedAt: null });
}

export function renameClass(store: DataWriter, id: string, name: string) {
  return store.update("classes", id, { name });
}

export type ArchiveClassResult = { status: "archived" } | { status: "hasStudents"; count: number };

/** Archives a class, unless it still has active students (they must be handled first). */
export function archiveClass(
  store: DataWriter,
  classId: string,
  now = Date.now(),
): Promise<ArchiveClassResult> {
  return store.transaction(async (tx) => {
    const count = (await activeStudentsOf(tx, classId)).length;
    if (count > 0) return { status: "hasStudents", count } as const;
    await tx.update("classes", classId, { archivedAt: now });
    return { status: "archived" } as const;
  });
}

/** Archives the class together with all of its active students. */
export async function archiveClassWithStudents(
  store: DataWriter,
  classId: string,
  now = Date.now(),
) {
  await store.transaction(async (tx) => {
    for (const student of await activeStudentsOf(tx, classId)) {
      await tx.update("students", student.id, { archivedAt: now });
    }
    await tx.update("classes", classId, { archivedAt: now });
  });
}

/** Moves the class's active students to another class, then archives it. */
export async function moveStudentsAndArchive(
  store: DataWriter,
  classId: string,
  targetClassId: string,
  now = Date.now(),
) {
  if (classId === targetClassId) throw new Error("Target class must be a different class");
  await store.transaction(async (tx) => {
    for (const student of await activeStudentsOf(tx, classId)) {
      await tx.update("students", student.id, { classId: targetClassId });
    }
    await tx.update("classes", classId, { archivedAt: now });
  });
}

export function unarchiveClass(store: DataWriter, classId: string) {
  return store.update("classes", classId, { archivedAt: null });
}
