import { useLiveQuery } from "dexie-react-hooks";
import { useLocale } from "next-intl";
import { loadClassStudents, loadStudent } from "@qct/core/data/entities/students";
import { useApp } from "../app-context";

export * from "@qct/core/data/entities/students";

/** A class's active and archived students, sorted by name. */
export function useClassStudents(classId: string | null) {
  const { db } = useApp();
  const locale = useLocale();
  return useLiveQuery(
    async () => (classId ? loadClassStudents(db, classId, locale) : { active: [], archived: [] }),
    [db, classId, locale],
  );
}

export function useStudent(id: string | null) {
  const { db } = useApp();
  // null = not found, undefined = still loading.
  return useLiveQuery(async () => (id ? loadStudent(db, id) : null), [db, id]);
}
