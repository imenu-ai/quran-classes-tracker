import { useLiveQuery } from "dexie-react-hooks";
import { loadStudentProfile } from "@qct/core/data/entities/profile";
import type { StudentProfile } from "@qct/core/domain/stats/month-sheet";
import { useApp } from "../app-context";

export {
  buildMonthHistory,
  buildStudentProfile,
  referencedLessonIds,
  type HistoryRow,
  type StudentProfile,
} from "@qct/core/domain/stats/month-sheet";

/** Everything the student profile shows, live from the local database. */
export function useStudentProfile(studentId: string | null) {
  const { db } = useApp();
  return useLiveQuery(
    async (): Promise<StudentProfile | null> =>
      studentId ? loadStudentProfile(db, studentId) : null,
    [db, studentId],
  );
}
