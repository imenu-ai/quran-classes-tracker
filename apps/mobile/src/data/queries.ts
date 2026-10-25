import { loadActiveClasses, loadClass, loadClassList } from "@qct/core/data/entities/classes";
import { loadStudentSearch } from "@qct/core/data/entities/search";
import { loadClassStudents, loadStudent } from "@qct/core/data/entities/students";
import { useAppLocale } from "@/i18n/locale";
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
