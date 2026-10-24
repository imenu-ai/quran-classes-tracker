import { monthKey } from "../../domain/dates/local-date";
import { classStatistics, type ClassStatistics, type StatsPeriod } from "../../domain/stats/class";
import type { StudentRecord } from "../../shared/schemas/student";
import type { StorageReader } from "../storage";
import { isActive } from "./classes";

export interface ClassStatisticsView {
  statistics: ClassStatistics;
  /** The class's active students, by id (for names). */
  students: Map<string, StudentRecord>;
  /** Years that have lessons, newest first (for the year picker). */
  years: number[];
  /** Months that have lessons ("YYYY-MM"), newest first (for printing). */
  months: string[];
}

/** A class's statistics and student ranking for a period. */
export async function loadClassStatistics(
  db: StorageReader,
  classId: string,
  period: StatsPeriod,
  timeZone: string,
  locale: string,
): Promise<ClassStatisticsView> {
  const [allStudents, lessons] = await Promise.all([
    db.query("students", "classId", { equals: classId }),
    db.query("lessons", "classId", { equals: classId }),
  ]);
  const students = allStudents.filter(isActive);
  const [attendance, homework] = await Promise.all([
    db.query("attendance", "lessonId", { anyOf: lessons.map((lesson) => lesson.id) }),
    db.query("homework", "studentId", { anyOf: students.map((student) => student.id) }),
  ]);
  const liveLessons = lessons.filter((lesson) => lesson.deletedAt === null);
  const years = [...new Set(liveLessons.map((lesson) => Number(lesson.date.slice(0, 4))))].sort(
    (a, b) => b - a,
  );
  const months = [...new Set(liveLessons.map((lesson) => monthKey(lesson.date)))].sort((a, b) =>
    b.localeCompare(a),
  );
  return {
    statistics: classStatistics({
      students,
      lessons,
      attendance,
      homework,
      period,
      timeZone,
      locale,
    }),
    students: new Map(students.map((student) => [student.id, student])),
    years,
    months,
  };
}
