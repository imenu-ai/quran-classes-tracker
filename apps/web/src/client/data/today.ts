import { useLiveQuery } from "dexie-react-hooks";
import { todayInTimeZone, type LocalDate } from "@/domain/dates/local-date";
import { splitLessonHomework, type StudentLessonHomework } from "@/domain/homework/progress";
import { lessonIdFor } from "@/shared/ids";
import type { AttendanceRecord } from "@/shared/schemas/attendance";
import type { HomeworkRecord } from "@/shared/schemas/homework";
import type { LessonRecord } from "@/shared/schemas/lesson";
import type { StudentRecord } from "@/shared/schemas/student";
import { useApp } from "../app-context";
import type { LocalStore } from "../db/local-store";
import { findAttendance } from "./attendance";
import { startLesson } from "./lessons";

export interface StudentToday {
  date: LocalDate;
  /**
   * Today's lesson for the student's class, or null when nothing has been
   * recorded today yet. Nothing creates it just by looking.
   */
  lesson: LessonRecord | null;
  /** The id today's lesson has, or will have once something is recorded. */
  lessonId: string;
  attendance: AttendanceRecord | null;
  homework: StudentLessonHomework<HomeworkRecord>;
  /** All of the student's live homework (for the next-homework suggestion). */
  history: HomeworkRecord[];
}

/** What the student page shows for today, live from the local database. */
export function useStudentToday(student: StudentRecord | null | undefined) {
  const { db, session } = useApp();
  const studentId = student?.id;
  const classId = student?.classId;
  return useLiveQuery(async (): Promise<StudentToday | null> => {
    if (!studentId || !classId) return null;
    const date = todayInTimeZone(session.timezone);
    const lesson =
      (await db.lessons.where("[classId+date]").equals([classId, date]).toArray()).find(
        (candidate) => candidate.deletedAt === null,
      ) ?? null;
    const lessonId = lesson?.id ?? lessonIdFor(classId, date);

    const homework = (await db.homework.where("studentId").equals(studentId).toArray()).filter(
      (item) => item.deletedAt === null,
    );
    const lessonIds = [
      ...new Set(homework.flatMap((item) => [item.assignedLessonId, item.evaluatedLessonId])),
    ].filter((id): id is string => id !== null);
    const lessonDates = new Map(
      (await db.lessons.bulkGet(lessonIds))
        .filter((l): l is LessonRecord => l !== undefined)
        .map((l) => [l.id, l.date] as const),
    );
    const attendance = lesson ? await findAttendance(db, lesson.id, studentId) : undefined;
    return {
      date,
      lesson,
      lessonId,
      attendance: attendance && attendance.deletedAt === null ? attendance : null,
      homework: splitLessonHomework(homework, { id: lessonId, date }, lessonDates),
      history: homework,
    };
  }, [db, studentId, classId, session.timezone]);
}

/**
 * Today's lesson for a class, created on the first thing recorded today
 * (a mark, a postponement, an absence, new homework). Returns its id.
 */
export async function todayLessonId(
  store: LocalStore,
  classId: string,
  date: LocalDate,
): Promise<string> {
  return (await startLesson(store, classId, date)).id;
}
