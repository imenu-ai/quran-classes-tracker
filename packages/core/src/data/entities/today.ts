import { todayInTimeZone, type LocalDate } from "../../domain/dates/local-date";
import { splitLessonHomework, type StudentLessonHomework } from "../../domain/homework/progress";
import { lessonIdFor } from "../../shared/ids";
import type { AttendanceRecord } from "../../shared/schemas/attendance";
import type { HomeworkRecord } from "../../shared/schemas/homework";
import type { LessonRecord } from "../../shared/schemas/lesson";
import type { StudentRecord } from "../../shared/schemas/student";
import type { DataWriter } from "../local-store";
import type { StorageReader } from "../storage";
import { findAttendance } from "./attendance";
import { findLiveLesson, startLesson } from "./lessons";

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

/** What the student page shows for today ("today" in the center's time zone). */
export async function loadStudentToday(
  db: StorageReader,
  student: Pick<StudentRecord, "id" | "classId">,
  timeZone: string,
): Promise<StudentToday> {
  const date = todayInTimeZone(timeZone);
  const lesson = (await findLiveLesson(db, student.classId, date)) ?? null;
  const lessonId = lesson?.id ?? lessonIdFor(student.classId, date);

  const homework = (await db.query("homework", "studentId", { equals: student.id })).filter(
    (item) => item.deletedAt === null,
  );
  const lessonIds = [
    ...new Set(homework.flatMap((item) => [item.assignedLessonId, item.evaluatedLessonId])),
  ].filter((id): id is string => id !== null);
  const lessonDates = new Map(
    (await db.bulkGet("lessons", lessonIds))
      .filter((l): l is LessonRecord => l !== undefined)
      .map((l) => [l.id, l.date] as const),
  );
  const attendance = lesson ? await findAttendance(db, lesson.id, student.id) : undefined;
  return {
    date,
    lesson,
    lessonId,
    attendance: attendance && attendance.deletedAt === null ? attendance : null,
    homework: splitLessonHomework(homework, { id: lessonId, date }, lessonDates),
    history: homework,
  };
}

/**
 * Today's lesson for a class, created on the first thing recorded today
 * (a mark, a postponement, an absence, new homework). Returns its id.
 */
export async function todayLessonId(
  store: DataWriter,
  classId: string,
  date: LocalDate,
): Promise<string> {
  return (await startLesson(store, classId, date)).id;
}
