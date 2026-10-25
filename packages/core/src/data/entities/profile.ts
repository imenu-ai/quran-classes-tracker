import {
  buildStudentProfile,
  referencedLessonIds,
  type StudentProfile,
} from "../../domain/stats/month-sheet";
import type { LessonRecord } from "../../shared/schemas/lesson";
import type { StorageReader } from "../storage";

/** Everything the student profile shows. */
export async function loadStudentProfile(
  db: StorageReader,
  studentId: string,
): Promise<StudentProfile> {
  const [homework, attendance] = await Promise.all([
    db.query("homework", "studentId", { equals: studentId }),
    db.query("attendance", "studentId", { equals: studentId }),
  ]);
  const lessonIds = referencedLessonIds(
    homework.filter((h) => h.deletedAt === null),
    attendance.filter((a) => a.deletedAt === null),
  );
  const lessons = (await db.bulkGet("lessons", lessonIds)).filter(
    (l): l is LessonRecord => l !== undefined,
  );
  return buildStudentProfile(homework, attendance, lessons);
}
