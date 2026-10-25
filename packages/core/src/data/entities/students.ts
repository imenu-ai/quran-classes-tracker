import type { MemorizationDirection, StudentRecord } from "../../shared/schemas/student";
import type { DataWriter } from "../local-store";
import type { StorageReader } from "../storage";
import { isActive, isArchived } from "./classes";

/** Fields a teacher fills in for a student. */
export interface StudentInput {
  classId: string;
  fullName: string;
  /** undefined when left empty; validation reports it as required. */
  birthYear: number | undefined;
  note: string;
  memorizationDirection: MemorizationDirection;
  /** The parent's ID number, normalized ("" when not set). */
  parentId: string;
}

export function sortByName(students: StudentRecord[], locale: string): StudentRecord[] {
  const collator = new Intl.Collator(locale);
  return students.sort((a, b) => collator.compare(a.fullName, b.fullName));
}

/** A class's active and archived students, sorted by name. */
export async function loadClassStudents(db: StorageReader, classId: string, locale: string) {
  const students = await db.query("students", "classId", { equals: classId });
  return {
    active: sortByName(students.filter(isActive), locale),
    archived: sortByName(students.filter(isArchived), locale),
  };
}

/** The student, or null when they don't exist. */
export async function loadStudent(db: StorageReader, id: string) {
  return (await db.get("students", id)) ?? null;
}

export function createStudent(store: DataWriter, input: StudentInput) {
  return store.create("students", {
    ...(input as Omit<StudentInput, "birthYear"> & { birthYear: number }),
    archivedAt: null,
  });
}

export function updateStudent(store: DataWriter, id: string, input: StudentInput) {
  return store.update(
    "students",
    id,
    input as Omit<StudentInput, "birthYear"> & { birthYear: number },
  );
}

/** Moves a student to another class. Their history (homework, attendance) moves with them. */
export function moveStudent(store: DataWriter, id: string, classId: string) {
  return store.update("students", id, { classId });
}

export function archiveStudent(store: DataWriter, id: string, now = Date.now()) {
  return store.update("students", id, { archivedAt: now });
}

export function unarchiveStudent(store: DataWriter, id: string) {
  return store.update("students", id, { archivedAt: null });
}
