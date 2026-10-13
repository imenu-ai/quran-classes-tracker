import { useLiveQuery } from "dexie-react-hooks";
import {
  buildStudentProfile,
  referencedLessonIds,
  type StudentProfile,
} from "@/domain/stats/month-sheet";
import type { LessonRecord } from "@/shared/schemas/lesson";
import { useApp } from "../app-context";

export {
  buildMonthHistory,
  buildStudentProfile,
  referencedLessonIds,
  type HistoryRow,
  type StudentProfile,
} from "@/domain/stats/month-sheet";

/** Everything the student profile shows, live from the local database. */
export function useStudentProfile(studentId: string | null) {
  const { db } = useApp();
  return useLiveQuery(async (): Promise<StudentProfile | null> => {
    if (!studentId) return null;
    const [homework, attendance] = await Promise.all([
      db.homework.where("studentId").equals(studentId).toArray(),
      db.attendance.where("studentId").equals(studentId).toArray(),
    ]);
    const lessonIds = referencedLessonIds(
      homework.filter((h) => h.deletedAt === null),
      attendance.filter((a) => a.deletedAt === null),
    );
    const lessons = (await db.lessons.bulkGet(lessonIds)).filter(
      (l): l is LessonRecord => l !== undefined,
    );
    return buildStudentProfile(homework, attendance, lessons);
  }, [db, studentId]);
}
