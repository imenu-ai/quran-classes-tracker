import { useLiveQuery } from "dexie-react-hooks";
import { loadStudentToday, type StudentToday } from "@qct/core/data/entities/today";
import type { StudentRecord } from "@qct/core/shared/schemas/student";
import { useApp } from "../app-context";

export * from "@qct/core/data/entities/today";

/** What the student page shows for today, live from the local database. */
export function useStudentToday(student: StudentRecord | null | undefined) {
  const { db, session } = useApp();
  const studentId = student?.id;
  const classId = student?.classId;
  return useLiveQuery(
    async (): Promise<StudentToday | null> =>
      studentId && classId
        ? loadStudentToday(db, { id: studentId, classId }, session.timezone)
        : null,
    [db, studentId, classId, session.timezone],
  );
}
