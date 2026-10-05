import { useLiveQuery } from "dexie-react-hooks";
import { useLocale } from "next-intl";
import type { MemorizationDirection, StudentRecord } from "@/shared/schemas/student";
import { useApp } from "../app-context";
import type { LocalStore } from "../db/local-store";
import { isActive, isArchived } from "./classes";

/** Fields a teacher fills in for a student. */
export interface StudentInput {
  classId: string;
  fullName: string;
  /** undefined when left empty; validation reports it as required. */
  birthYear: number | undefined;
  note: string;
  memorizationDirection: MemorizationDirection;
}

export function sortByName(students: StudentRecord[], locale: string): StudentRecord[] {
  const collator = new Intl.Collator(locale);
  return students.sort((a, b) => collator.compare(a.fullName, b.fullName));
}

/** A class's active and archived students, sorted by name. */
export function useClassStudents(classId: string | null) {
  const { db } = useApp();
  const locale = useLocale();
  return useLiveQuery(async () => {
    if (!classId) return { active: [], archived: [] };
    const students = await db.students.where("classId").equals(classId).toArray();
    return {
      active: sortByName(students.filter(isActive), locale),
      archived: sortByName(students.filter(isArchived), locale),
    };
  }, [db, classId, locale]);
}

export function useStudent(id: string | null) {
  const { db } = useApp();
  // null = not found, undefined = still loading.
  return useLiveQuery(async () => (id ? ((await db.students.get(id)) ?? null) : null), [db, id]);
}

export function createStudent(store: LocalStore, input: StudentInput) {
  return store.create("students", {
    ...(input as Omit<StudentInput, "birthYear"> & { birthYear: number }),
    archivedAt: null,
  });
}

export function updateStudent(store: LocalStore, id: string, input: StudentInput) {
  return store.update(
    "students",
    id,
    input as Omit<StudentInput, "birthYear"> & { birthYear: number },
  );
}

/** Moves a student to another class. Their history (homework, attendance) moves with them. */
export function moveStudent(store: LocalStore, id: string, classId: string) {
  return store.update("students", id, { classId });
}

export function archiveStudent(store: LocalStore, id: string, now = Date.now()) {
  return store.update("students", id, { archivedAt: now });
}

export function unarchiveStudent(store: LocalStore, id: string) {
  return store.update("students", id, { archivedAt: null });
}
