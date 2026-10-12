import { localDateOf, type LocalDate } from "../dates/local-date";
import { average } from "./monthly";

/** All time (year null), a whole year (month null), or one month of a year. */
export interface StatsPeriod {
  year: number | null;
  /** 1–12; only meaningful with a year. */
  month: number | null;
}

export const ALL_TIME: StatsPeriod = { year: null, month: null };

export function inPeriod(date: LocalDate, period: StatsPeriod): boolean {
  if (period.year === null) return true;
  if (Number(date.slice(0, 4)) !== period.year) return false;
  return period.month === null || Number(date.slice(5, 7)) === period.month;
}

interface StatsStudent {
  id: string;
  fullName: string;
  /** When the student was added (epoch ms): his attendance counts from that day. */
  createdAt: number;
}

interface StatsLesson {
  id: string;
  date: LocalDate;
  deletedAt: number | null;
}

interface StatsAttendance {
  lessonId: string;
  studentId: string;
  status: "present" | "absent" | "excused";
  deletedAt: number | null;
}

interface StatsHomework {
  /** Exams are left out of every average. */
  kind?: "homework" | "exam";
  studentId: string;
  evaluatedLessonId: string | null;
  memorizationRate: number | null;
  behaviorRate: number | null;
  deletedAt: number | null;
}

export interface StudentStanding {
  studentId: string;
  present: number;
  absent: number;
  excused: number;
  /** Present + excused: an excused absence counts as attended in the ranking. */
  attended: number;
  /** Lesson days he could attend: on or after the day he joined (or recorded). */
  possible: number;
  /** attended / possible, from 0 to 1; null without possible days. */
  rate: number | null;
  memorizationAverage: number | null;
  behaviorAverage: number | null;
}

export interface ClassStatistics {
  /** The class's lesson days in the period. */
  lessonDays: number;
  present: number;
  absent: number;
  excused: number;
  attended: number;
  possible: number;
  rate: number | null;
  memorizationAverage: number | null;
  behaviorAverage: number | null;
  /** Best first (see rankStudents). */
  students: StudentStanding[];
}

const descending = (a: number | null, b: number | null) => {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return b - a;
};

/**
 * Best first: attendance rate, then average memorization mark, then
 * average behavior mark (each highest first, none last), then name.
 */
export function rankStudents(
  standings: readonly StudentStanding[],
  nameOf: (studentId: string) => string,
  locale: string,
): StudentStanding[] {
  const collator = new Intl.Collator(locale);
  return [...standings].sort(
    (a, b) =>
      descending(a.rate, b.rate) ||
      descending(a.memorizationAverage, b.memorizationAverage) ||
      descending(a.behaviorAverage, b.behaviorAverage) ||
      collator.compare(nameOf(a.studentId), nameOf(b.studentId)),
  );
}

/**
 * A class's statistics for a period, computed from its records (never
 * stored): the attendance and average marks of the class, and each student's
 * standing, ranked best first. Deleted lessons and records don't count, and
 * neither do postponed recitations (they have no marks).
 */
export function classStatistics(input: {
  students: readonly StatsStudent[];
  lessons: readonly StatsLesson[];
  attendance: readonly StatsAttendance[];
  homework: readonly StatsHomework[];
  period: StatsPeriod;
  timeZone: string;
  locale: string;
}): ClassStatistics {
  const lessons = input.lessons.filter(
    (lesson) => lesson.deletedAt === null && inPeriod(lesson.date, input.period),
  );
  const lessonDate = new Map(lessons.map((lesson) => [lesson.id, lesson.date]));
  const studentIds = new Set(input.students.map((student) => student.id));

  const recordsOf = new Map<string, StatsAttendance[]>();
  for (const record of input.attendance) {
    if (record.deletedAt !== null || !lessonDate.has(record.lessonId)) continue;
    if (!studentIds.has(record.studentId)) continue;
    const list = recordsOf.get(record.studentId) ?? [];
    list.push(record);
    recordsOf.set(record.studentId, list);
  }

  const scoresOf = new Map<string, { memorization: number[]; behavior: number[] }>();
  const allMemorization: number[] = [];
  const allBehavior: number[] = [];
  for (const item of input.homework) {
    if (item.deletedAt !== null || item.evaluatedLessonId === null) continue;
    if (item.kind === "exam") continue;
    if (!lessonDate.has(item.evaluatedLessonId) || !studentIds.has(item.studentId)) continue;
    const scores = scoresOf.get(item.studentId) ?? { memorization: [], behavior: [] };
    if (item.memorizationRate !== null) {
      scores.memorization.push(item.memorizationRate);
      allMemorization.push(item.memorizationRate);
    }
    if (item.behaviorRate !== null) {
      scores.behavior.push(item.behaviorRate);
      allBehavior.push(item.behaviorRate);
    }
    scoresOf.set(item.studentId, scores);
  }

  const standings = input.students.map((student): StudentStanding => {
    const joined = localDateOf(student.createdAt, input.timeZone);
    const records = recordsOf.get(student.id) ?? [];
    // Days he could attend: from the day he joined, plus any day he has a
    // record for (e.g. recorded later for an earlier day), so the rate is ≤ 1.
    const possibleDays = new Set(
      lessons.filter((lesson) => lesson.date >= joined).map((lesson) => lesson.id),
    );
    for (const record of records) possibleDays.add(record.lessonId);
    const count = (status: StatsAttendance["status"]) =>
      records.filter((record) => record.status === status).length;
    const present = count("present");
    const excused = count("excused");
    const attended = present + excused;
    const possible = possibleDays.size;
    const scores = scoresOf.get(student.id);
    return {
      studentId: student.id,
      present,
      absent: count("absent"),
      excused,
      attended,
      possible,
      rate: possible > 0 ? attended / possible : null,
      memorizationAverage: average(scores?.memorization ?? []),
      behaviorAverage: average(scores?.behavior ?? []),
    };
  });

  const sum = (pick: (standing: StudentStanding) => number) =>
    standings.reduce((total, standing) => total + pick(standing), 0);
  const attended = sum((s) => s.attended);
  const possible = sum((s) => s.possible);
  const names = new Map(input.students.map((student) => [student.id, student.fullName]));

  return {
    lessonDays: lessons.length,
    present: sum((s) => s.present),
    absent: sum((s) => s.absent),
    excused: sum((s) => s.excused),
    attended,
    possible,
    rate: possible > 0 ? attended / possible : null,
    memorizationAverage: average(allMemorization),
    behaviorAverage: average(allBehavior),
    students: rankStudents(standings, (id) => names.get(id) ?? "", input.locale),
  };
}
