import { useLiveQuery } from "dexie-react-hooks";
import { useLocale } from "next-intl";
import { monthKey } from "@/domain/dates/local-date";
import { classStatistics, type ClassStatistics, type StatsPeriod } from "@/domain/stats/class";
import type { StudentRecord } from "@/shared/schemas/student";
import { useApp } from "../app-context";
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

/** A class's statistics and student ranking for a period, live from the local database. */
export function useClassStatistics(classId: string | null, period: StatsPeriod) {
  const { db, session } = useApp();
  const locale = useLocale();
  return useLiveQuery(async (): Promise<ClassStatisticsView | null> => {
    if (!classId) return null;
    const [allStudents, lessons] = await Promise.all([
      db.students.where("classId").equals(classId).toArray(),
      db.lessons.where("classId").equals(classId).toArray(),
    ]);
    const students = allStudents.filter(isActive);
    const [attendance, homework] = await Promise.all([
      db.attendance
        .where("lessonId")
        .anyOf(lessons.map((lesson) => lesson.id))
        .toArray(),
      db.homework
        .where("studentId")
        .anyOf(students.map((student) => student.id))
        .toArray(),
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
        timeZone: session.timezone,
        locale,
      }),
      students: new Map(students.map((student) => [student.id, student])),
      years,
      months,
    };
  }, [db, classId, period.year, period.month, session.timezone, locale]);
}
