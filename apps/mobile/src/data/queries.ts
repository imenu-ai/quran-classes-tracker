import { loadClassStatistics } from "@qct/core/data/entities/class-stats";
import { loadActiveClasses, loadClass, loadClassList } from "@qct/core/data/entities/classes";
import { loadStudentProfile } from "@qct/core/data/entities/profile";
import { loadStudentSearch } from "@qct/core/data/entities/search";
import { loadClassStudents, loadStudent } from "@qct/core/data/entities/students";
import { loadStudentToday } from "@qct/core/data/entities/today";
import type { StatsPeriod } from "@qct/core/domain/stats/class";
import type { StudentRecord } from "@qct/core/shared/schemas/student";
import { useAppLocale } from "@/i18n/locale";
import { useApp } from "./app-data";
import { useLocalQuery } from "./use-local-query";

// The shared queries as live screen data, like the web's `client/data` hooks.
// undefined while loading; null when a record doesn't exist.

/** Home: active class summaries and archived classes. */
export function useClassList() {
  const locale = useAppLocale();
  return useLocalQuery((db) => loadClassList(db, locale), [locale], ["classes", "students"]);
}

/** Every active class, by name (for "move to" pickers). */
export function useActiveClasses() {
  const locale = useAppLocale();
  return useLocalQuery((db) => loadActiveClasses(db, locale), [locale], ["classes"]);
}

export function useClass(id: string | null) {
  return useLocalQuery(async (db) => (id ? loadClass(db, id) : null), [id], ["classes"]);
}

/** A class's active and archived students, by name. */
export function useClassStudents(classId: string) {
  const locale = useAppLocale();
  return useLocalQuery(
    (db) => loadClassStudents(db, classId, locale),
    [classId, locale],
    ["students"],
  );
}

export function useStudent(id: string | null) {
  return useLocalQuery(async (db) => (id ? loadStudent(db, id) : null), [id], ["students"]);
}

export function useStudentSearch(query: string) {
  const locale = useAppLocale();
  return useLocalQuery(
    (db) => loadStudentSearch(db, query, locale),
    [query, locale],
    ["students", "classes"],
  );
}

/** Today for one student: the lesson (if started), attendance and homework. */
export function useStudentToday(student: Pick<StudentRecord, "id" | "classId"> | null) {
  const { session } = useApp();
  const id = student?.id;
  const classId = student?.classId;
  return useLocalQuery(
    async (db) => (id && classId ? loadStudentToday(db, { id, classId }, session.timezone) : null),
    [id, classId, session.timezone],
    ["lessons", "attendance", "homework"],
  );
}

/** The student's months: homework, attendance and their lessons. */
export function useStudentProfile(studentId: string | null) {
  return useLocalQuery(
    async (db) => (studentId ? loadStudentProfile(db, studentId) : null),
    [studentId],
    ["lessons", "attendance", "homework"],
  );
}

/** A student's live homework (the next-homework suggestion reads it). */
export function useStudentHomework(studentId: string | null) {
  return useLocalQuery(
    async (db) =>
      studentId
        ? (await db.query("homework", "studentId", { equals: studentId })).filter(
            (item) => item.deletedAt === null,
          )
        : null,
    [studentId],
    ["homework"],
  );
}

/** A class's statistics and ranked students for a period (all time, a year or a month). */
export function useClassStatistics(classId: string, period: StatsPeriod) {
  const { session } = useApp();
  const locale = useAppLocale();
  return useLocalQuery(
    (db) => loadClassStatistics(db, classId, period, session.timezone, locale),
    [classId, period.year, period.month, session.timezone, locale],
  );
}
