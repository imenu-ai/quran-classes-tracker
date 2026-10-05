import { monthKey } from "../dates/local-date";

interface StatsLesson {
  id: string;
  date: string;
  deletedAt: number | null;
}

interface StatsHomework {
  evaluatedLessonId: string | null;
  memorizationRate: number | null;
  behaviorRate: number | null;
  deletedAt: number | null;
}

interface StatsAttendance {
  lessonId: string;
  status: "present" | "absent" | "excused";
  deletedAt: number | null;
}

export interface MonthStats {
  /** "YYYY-MM". */
  month: string;
  /** Average تقييم الحفظ of items evaluated that month, 1 decimal; null without scores. */
  memorizationAverage: number | null;
  /** Average تقييم السلوك, 1 decimal; null without scores. */
  behaviorAverage: number | null;
  /** Homework items evaluated that month. */
  evaluatedCount: number;
  /** أيام الحضور. */
  present: number;
  absent: number;
  excused: number;
}

const roundToOneDecimal = (value: number) => Math.round(value * 10) / 10;

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return roundToOneDecimal(values.reduce((sum, v) => sum + v, 0) / values.length);
}

/**
 * Monthly statistics for one student, always computed (never stored),
 * newest month first. A homework item counts in the month of the lesson
 * where it was EVALUATED; attendance in the month of its lesson. Deleted
 * records, and anything belonging to a deleted lesson, are ignored. Each
 * average uses only the scores that exist.
 */
export function monthlyStats(
  homework: readonly StatsHomework[],
  attendance: readonly StatsAttendance[],
  lessons: readonly StatsLesson[],
): MonthStats[] {
  const lessonMonth = new Map(
    lessons.filter((l) => l.deletedAt === null).map((l) => [l.id, monthKey(l.date)]),
  );

  interface Bucket {
    memorization: number[];
    behavior: number[];
    evaluatedCount: number;
    present: number;
    absent: number;
    excused: number;
  }
  const buckets = new Map<string, Bucket>();
  const bucket = (month: string) => {
    let b = buckets.get(month);
    if (!b) {
      b = { memorization: [], behavior: [], evaluatedCount: 0, present: 0, absent: 0, excused: 0 };
      buckets.set(month, b);
    }
    return b;
  };

  for (const item of homework) {
    if (item.deletedAt !== null || item.evaluatedLessonId === null) continue;
    const month = lessonMonth.get(item.evaluatedLessonId);
    if (!month) continue;
    const b = bucket(month);
    b.evaluatedCount += 1;
    if (item.memorizationRate !== null) b.memorization.push(item.memorizationRate);
    if (item.behaviorRate !== null) b.behavior.push(item.behaviorRate);
  }

  for (const record of attendance) {
    if (record.deletedAt !== null) continue;
    const month = lessonMonth.get(record.lessonId);
    if (!month) continue;
    bucket(month)[record.status] += 1;
  }

  return [...buckets.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([month, b]) => ({
      month,
      memorizationAverage: average(b.memorization),
      behaviorAverage: average(b.behavior),
      evaluatedCount: b.evaluatedCount,
      present: b.present,
      absent: b.absent,
      excused: b.excused,
    }));
}
