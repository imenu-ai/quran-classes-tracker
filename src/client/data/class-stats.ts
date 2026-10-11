import { useLiveQuery } from "dexie-react-hooks";
import { useLocale } from "next-intl";
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
    const years = [
      ...new Set(
        lessons
          .filter((lesson) => lesson.deletedAt === null)
          .map((lesson) => Number(lesson.date.slice(0, 4))),
      ),
    ].sort((a, b) => b - a);
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
    };
  }, [db, classId, period.year, period.month, session.timezone, locale]);
}
