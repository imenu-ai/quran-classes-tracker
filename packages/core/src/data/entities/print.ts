import {
  buildMonthSheet,
  buildStudentProfile,
  referencedLessonIds,
  type MonthSheet,
} from "../../domain/stats/month-sheet";
import type { ClassRecord } from "../../shared/schemas/class";
import type { LessonRecord } from "../../shared/schemas/lesson";
import type { StudentRecord } from "../../shared/schemas/student";
import type { StorageReader } from "../storage";

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
  db: StorageReader,
  classId: string,
  studentIds: readonly string[],
  month: string,
): Promise<PrintSheets | null> {
  const cls = await db.get("classes", classId);
  if (!cls || cls.deletedAt !== null) return null;
  const ids = [...new Set(studentIds)];
  const students = (await db.bulkGet("students", ids)).filter(
    (s): s is StudentRecord => s !== undefined && s.deletedAt === null && s.classId === classId,
  );
  const studentIdList = students.map((s) => s.id);
  const [homework, attendance] = await Promise.all([
    db.query("homework", "studentId", { anyOf: studentIdList }),
    db.query("attendance", "studentId", { anyOf: studentIdList }),
  ]);
  const lessons = (
    await db.bulkGet(
      "lessons",
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
