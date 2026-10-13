import { useLiveQuery } from "dexie-react-hooks";
import { monthKey } from "@/domain/dates/local-date";
import { monthlyStats, type MonthStats } from "@/domain/stats/monthly";
import type { AttendanceRecord } from "@/shared/schemas/attendance";
import { postponedLessonsOf, type HomeworkRecord } from "@/shared/schemas/homework";
import type { LessonRecord } from "@/shared/schemas/lesson";
import { useApp } from "../app-context";

export type HistoryRow =
  | { kind: "evaluation"; lesson: LessonRecord; item: HomeworkRecord }
  | { kind: "postponed"; lesson: LessonRecord; item: HomeworkRecord }
  | { kind: "absence"; lesson: LessonRecord; record: AttendanceRecord };

const KIND_ORDER: Record<HistoryRow["kind"], number> = { evaluation: 0, postponed: 1, absence: 2 };

/**
 * One month of a student's record, newest first: every homework item
 * evaluated in that month's lessons, every postponed recitation, and
 * absences (with excuse notes). Within a day: evaluations, then
 * postponements, then the absence row.
 */
export function buildMonthHistory(
  homework: readonly HomeworkRecord[],
  attendance: readonly AttendanceRecord[],
  lessonsById: ReadonlyMap<string, LessonRecord>,
  month: string,
): HistoryRow[] {
  const inMonth = (lessonId: string | null) => {
    const lesson = lessonId ? lessonsById.get(lessonId) : undefined;
    return lesson && lesson.deletedAt === null && monthKey(lesson.date) === month ? lesson : null;
  };
  const rows: HistoryRow[] = [];
  for (const item of homework) {
    const lesson = item.deletedAt === null ? inMonth(item.evaluatedLessonId) : null;
    if (lesson) rows.push({ kind: "evaluation", lesson, item });
    if (item.deletedAt !== null) continue;
    for (const lessonId of postponedLessonsOf(item)) {
      const postponedIn = inMonth(lessonId);
      if (postponedIn) rows.push({ kind: "postponed", lesson: postponedIn, item });
    }
  }
  for (const record of attendance) {
    if (record.deletedAt !== null || record.status === "present") continue;
    const lesson = inMonth(record.lessonId);
    if (lesson) rows.push({ kind: "absence", lesson, record });
  }
  return rows.sort(
    (a, b) => b.lesson.date.localeCompare(a.lesson.date) || KIND_ORDER[a.kind] - KIND_ORDER[b.kind],
  );
}

export interface StudentProfile {
  homework: HomeworkRecord[];
  attendance: AttendanceRecord[];
  lessonsById: Map<string, LessonRecord>;
  /** Not evaluated yet, oldest first. */
  pending: HomeworkRecord[];
  /** Newest month first. */
  months: MonthStats[];
}

/** The lessons a student's records refer to (to load before building the profile). */
export function referencedLessonIds(
  homework: readonly HomeworkRecord[],
  attendance: readonly AttendanceRecord[],
): string[] {
  return [
    ...new Set([
      ...homework.flatMap((h) => [
        h.evaluatedLessonId,
        h.assignedLessonId,
        ...postponedLessonsOf(h),
      ]),
      ...attendance.map((a) => a.lessonId),
    ]),
  ].filter((id): id is string => id !== null);
}

/**
 * A student's profile from his records (deleted ones are left out) and the
 * lessons they refer to. Extra lessons (another student's) are harmless.
 */
export function buildStudentProfile(
  homework: readonly HomeworkRecord[],
  attendance: readonly AttendanceRecord[],
  lessons: readonly LessonRecord[],
): StudentProfile {
  const liveHomework = homework.filter((h) => h.deletedAt === null);
  const liveAttendance = attendance.filter((a) => a.deletedAt === null);
  return {
    homework: liveHomework,
    attendance: liveAttendance,
    lessonsById: new Map(lessons.map((l) => [l.id, l])),
    pending: liveHomework
      .filter((h) => h.evaluatedLessonId === null)
      .sort((a, b) => a.createdAt - b.createdAt),
    months: monthlyStats(liveHomework, liveAttendance, lessons),
  };
}

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
