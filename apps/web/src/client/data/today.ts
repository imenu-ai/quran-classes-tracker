import { useLiveQuery } from "dexie-react-hooks";
import { loadStudentDay, loadStudentToday, type StudentToday } from "@qct/core/data/entities/today";
import type { LocalDate } from "@qct/core/domain/dates/local-date";
import type { StudentRecord } from "@qct/core/shared/schemas/student";
import { useApp } from "../app-context";

export * from "@qct/core/data/entities/today";

/**
 * What the student page shows for today, or for `date` (a past day picked
 * with "إضافة جلسة"), live from the local database.
 */
export function useStudentToday(student: StudentRecord | null | undefined, date?: LocalDate) {
  const { db, session } = useApp();
  const studentId = student?.id;
  const classId = student?.classId;
  return useLiveQuery(async (): Promise<StudentToday | null> => {
    if (!studentId || !classId) return null;
    return date
      ? loadStudentDay(db, { id: studentId, classId }, date)
      : loadStudentToday(db, { id: studentId, classId }, session.timezone);
  }, [db, studentId, classId, session.timezone, date]);
}
