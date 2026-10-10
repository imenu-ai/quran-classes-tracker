import { useLiveQuery } from "dexie-react-hooks";
import { useLocale } from "next-intl";
import type { ClassRecord } from "@/shared/schemas/class";
import type { StudentRecord } from "@/shared/schemas/student";
import { useApp } from "../app-context";
import type { LocalDb } from "../db/dexie";
import type { LocalStore } from "../db/local-store";

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

/** Home screen data: active class summaries and archived classes. */
export function useClassList() {
  const { db } = useApp();
  const locale = useLocale();
  return useLiveQuery(async () => {
    const [classes, students] = await Promise.all([db.classes.toArray(), db.students.toArray()]);
    const collator = new Intl.Collator(locale);
    return {
      active: summarizeClasses(classes, students, locale),
      archived: classes.filter(isArchived).sort((a, b) => collator.compare(a.name, b.name)),
    };
  }, [db, locale]);
}

/** Every active class (for "move to" pickers). */
export function useActiveClasses() {
  const { db } = useApp();
  const locale = useLocale();
  return useLiveQuery(async () => {
    const collator = new Intl.Collator(locale);
    return (await db.classes.toArray())
      .filter(isActive)
      .sort((a, b) => collator.compare(a.name, b.name));
  }, [db, locale]);
}

export function useClass(id: string | null) {
  const { db } = useApp();
  // null = not found, undefined = still loading.
  return useLiveQuery(async () => (id ? ((await db.classes.get(id)) ?? null) : null), [db, id]);
}

// ---------------------------------------------------------------------------
// Actions. Multi-record actions run in one transaction: all or nothing.

const writableTables = (db: LocalDb) => [db.classes, db.students, db.outbox, db.rejected, db.meta];

export function createClass(store: LocalStore, name: string) {
  return store.create("classes", { name, archivedAt: null });
}

export function renameClass(store: LocalStore, id: string, name: string) {
  return store.update("classes", id, { name });
}

export async function activeStudentsOf(db: LocalDb, classId: string) {
  return (await db.students.where("classId").equals(classId).toArray()).filter(isActive);
}

export type ArchiveClassResult = { status: "archived" } | { status: "hasStudents"; count: number };

/** Archives a class, unless it still has active students (they must be handled first). */
export async function archiveClass(
  store: LocalStore,
  classId: string,
  now = Date.now(),
): Promise<ArchiveClassResult> {
  const { db } = store;
  return db.transaction("rw", writableTables(db), async () => {
    const count = (await activeStudentsOf(db, classId)).length;
    if (count > 0) return { status: "hasStudents", count } as const;
    await store.update("classes", classId, { archivedAt: now });
    return { status: "archived" } as const;
  });
}

/** Archives the class together with all of its active students. */
export async function archiveClassWithStudents(
  store: LocalStore,
  classId: string,
  now = Date.now(),
) {
  const { db } = store;
  await db.transaction("rw", writableTables(db), async () => {
    for (const student of await activeStudentsOf(db, classId)) {
      await store.update("students", student.id, { archivedAt: now });
    }
    await store.update("classes", classId, { archivedAt: now });
  });
}

/** Moves the class's active students to another class, then archives it. */
export async function moveStudentsAndArchive(
  store: LocalStore,
  classId: string,
  targetClassId: string,
  now = Date.now(),
) {
  if (classId === targetClassId) throw new Error("Target class must be a different class");
  const { db } = store;
  await db.transaction("rw", writableTables(db), async () => {
    for (const student of await activeStudentsOf(db, classId)) {
      await store.update("students", student.id, { classId: targetClassId });
    }
    await store.update("classes", classId, { archivedAt: now });
  });
}

export function unarchiveClass(store: LocalStore, classId: string) {
  return store.update("classes", classId, { archivedAt: null });
}
