import { useLiveQuery } from "dexie-react-hooks";
import type { LocalDb } from "../db/dexie";
import { useApp } from "../app-context";
import {
  buildMonthSheet,
  buildStudentProfile,
  referencedLessonIds,
  type MonthSheet,
} from "@/domain/stats/month-sheet";
import type { ClassRecord } from "@/shared/schemas/class";
import type { LessonRecord } from "@/shared/schemas/lesson";
import type { StudentRecord } from "@/shared/schemas/student";

export {
  buildMonthSheet,
  type MonthSheet,
  type MonthSheetCounts,
} from "@/domain/stats/month-sheet";

/** The print page for some of a class's students and a month ("YYYY-MM"). */
export function printHref(classId: string, month: string, studentIds: readonly string[]) {
  const params = new URLSearchParams({ class: classId, month, students: studentIds.join(",") });
  return `/print?${params.toString()}`;
}

export interface PrintSheets {
  cls: ClassRecord;
  sheets: MonthSheet[];
}

/**
 * The month sheets of a class's chosen students, in the order asked.
 * Students that aren't (or are no longer) in the class are left out; null
 * when the class doesn't exist.
 */
export async function loadPrintSheets(
  db: LocalDb,
  classId: string,
  studentIds: readonly string[],
  month: string,
): Promise<PrintSheets | null> {
  const cls = await db.classes.get(classId);
  if (!cls || cls.deletedAt !== null) return null;
  const ids = [...new Set(studentIds)];
  const students = (await db.students.bulkGet(ids)).filter(
    (s): s is StudentRecord => s !== undefined && s.deletedAt === null && s.classId === classId,
  );
  const studentIdList = students.map((s) => s.id);
  const [homework, attendance] = await Promise.all([
    db.homework.where("studentId").anyOf(studentIdList).toArray(),
    db.attendance.where("studentId").anyOf(studentIdList).toArray(),
  ]);
  const lessons = (
    await db.lessons.bulkGet(
      referencedLessonIds(
        homework.filter((h) => h.deletedAt === null),
        attendance.filter((a) => a.deletedAt === null),
      ),
    )
  ).filter((l): l is LessonRecord => l !== undefined);
  const sheets = students.map((student) =>
    buildMonthSheet(
      student,
      buildStudentProfile(
        homework.filter((h) => h.studentId === student.id),
        attendance.filter((a) => a.studentId === student.id),
        lessons,
      ),
      month,
    ),
  );
  return { cls, sheets };
}

/** The print page's data, live from the local database. */
export function usePrintSheets(
  classId: string | null,
  studentIds: readonly string[],
  month: string | null,
) {
  const { db } = useApp();
  const key = studentIds.join(",");
  return useLiveQuery(
    async () => (classId && month ? loadPrintSheets(db, classId, studentIds, month) : null),
    // The ids by value, so a new array with the same ids doesn't reload.
    [db, classId, key, month],
  );
}
