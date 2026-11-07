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

/** One day of a student's: today, or a past day picked with "إضافة جلسة". */
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
  /** His live homework up to that day (for the next-homework suggestion). */
  history: HomeworkRecord[];
}

/** What the student page shows for today ("today" in the center's time zone). */
export function loadStudentToday(
  db: StorageReader,
  student: Pick<StudentRecord, "id" | "classId">,
  timeZone: string,
): Promise<StudentToday> {
  return loadStudentDay(db, student, todayInTimeZone(timeZone));
}

/**
 * One day for a student, today or a past day the teacher picked ("إضافة
 * جلسة"): that day's lesson if the class has one, his attendance, the
 * homework due then (assigned before it and still pending), what was
 * evaluated and assigned in it, and his homework up to that day for the
 * suggestion (later homework is left out).
 */
export async function loadStudentDay(
  db: StorageReader,
  student: Pick<StudentRecord, "id" | "classId">,
  date: LocalDate,
): Promise<StudentToday> {
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
  const assignedBy = (item: HomeworkRecord) => {
    const assigned = item.assignedLessonId ? lessonDates.get(item.assignedLessonId) : undefined;
    return assigned === undefined || assigned <= date;
  };
  return {
    date,
    lesson,
    lessonId,
    attendance: attendance && attendance.deletedAt === null ? attendance : null,
    homework: splitLessonHomework(homework, { id: lessonId, date }, lessonDates),
    history: homework.filter(assignedBy),
  };
}

/**
 * Today's lesson for a class, created on the first thing recorded today
 * (a mark, "لم يحفظ", an absence, new homework). Returns its id.
 */
export async function todayLessonId(
  store: DataWriter,
  classId: string,
  date: LocalDate,
): Promise<string> {
  return (await startLesson(store, classId, date)).id;
}
