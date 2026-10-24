import { monthKey } from "../dates/local-date";
import { monthlyStats, type MonthStats } from "./monthly";
import type { AttendanceRecord } from "../../shared/schemas/attendance";
import { isExam, postponedLessonsOf, type HomeworkRecord } from "../../shared/schemas/homework";
import type { LessonRecord } from "../../shared/schemas/lesson";
import type { StudentRecord } from "../../shared/schemas/student";

/*
 * A student's month, built from plain records: the month table on his page,
 * the printed sheet and the parent page (on the server) all use these.
 */

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

export interface MonthSheetCounts {
  present: number;
  absent: number;
  excused: number;
  /** Homework recited and marked (exams aren't counted here). */
  evaluated: number;
  exams: number;
  postponed: number;
}

/** One student's month as a summary: the month table's rows, averages and counts. */
export interface MonthSheet {
  student: StudentRecord;
  /** Oldest day first (a month reads top to bottom). */
  rows: HistoryRow[];
  memorizationAverage: number | null;
  behaviorAverage: number | null;
  counts: MonthSheetCounts;
}

export function buildMonthSheet(
  student: StudentRecord,
  profile: StudentProfile,
  month: string,
): MonthSheet {
  // The history is newest first; a stable sort keeps each day's own order.
  const rows = buildMonthHistory(
    profile.homework,
    profile.attendance,
    profile.lessonsById,
    month,
  ).sort((a, b) => a.lesson.date.localeCompare(b.lesson.date));
  const stats = profile.months.find((m) => m.month === month);
  return {
    student,
    rows,
    memorizationAverage: stats?.memorizationAverage ?? null,
    behaviorAverage: stats?.behaviorAverage ?? null,
    counts: {
      present: stats?.present ?? 0,
      absent: stats?.absent ?? 0,
      excused: stats?.excused ?? 0,
      evaluated: stats?.evaluatedCount ?? 0,
      exams: rows.filter((row) => row.kind === "evaluation" && isExam(row.item)).length,
      postponed: rows.filter((row) => row.kind === "postponed").length,
    },
  };
}
