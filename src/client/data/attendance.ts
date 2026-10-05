import { useLiveQuery } from "dexie-react-hooks";
import { useLocale } from "next-intl";
import { attendanceIdFor } from "@/shared/ids";
import type { AttendanceRecord, AttendanceStatus } from "@/shared/schemas/attendance";
import type { StudentRecord } from "@/shared/schemas/student";
import { useApp } from "../app-context";
import type { LocalDb } from "../db/dexie";
import type { LocalStore } from "../db/local-store";
import { isActive } from "./classes";
import { sortByName } from "./students";

export interface AttendanceSummary {
  present: number;
  absent: number;
  excused: number;
  /** Students with any status recorded. */
  marked: number;
}

export function summarizeAttendance(records: readonly AttendanceRecord[]): AttendanceSummary {
  const live = records.filter((record) => record.deletedAt === null);
  const count = (status: AttendanceStatus) => live.filter((r) => r.status === status).length;
  return {
    present: count("present"),
    absent: count("absent"),
    excused: count("excused"),
    marked: live.length,
  };
}

export interface LessonRosterEntry {
  student: StudentRecord;
  attendance: AttendanceRecord | null;
}

/**
 * Who belongs on this lesson's attendance list: the class's active students,
 * plus anyone already recorded in this lesson (e.g. a student who later moved
 * class or was archived), sorted by name.
 */
export function buildRoster(
  classStudents: readonly StudentRecord[],
  allStudents: readonly StudentRecord[],
  records: readonly AttendanceRecord[],
  locale: string,
): LessonRosterEntry[] {
  const live = records.filter((record) => record.deletedAt === null);
  const byStudent = new Map(live.map((record) => [record.studentId, record]));
  const ids = new Set([...classStudents.filter(isActive).map((s) => s.id), ...byStudent.keys()]);
  // A student can come from both sources: keep one entry per id.
  const unique = new Map(
    allStudents.filter((s) => ids.has(s.id) && s.deletedAt === null).map((s) => [s.id, s]),
  );
  return sortByName([...unique.values()], locale).map((student) => ({
    student,
    attendance: byStudent.get(student.id) ?? null,
  }));
}

export function useLessonRoster(lessonId: string, classId: string) {
  const { db } = useApp();
  const locale = useLocale();
  return useLiveQuery(async () => {
    const [classStudents, records] = await Promise.all([
      db.students.where("classId").equals(classId).toArray(),
      db.attendance.where("lessonId").equals(lessonId).toArray(),
    ]);
    const recordedIds = records.map((record) => record.studentId);
    const recordedStudents = await db.students.bulkGet(recordedIds);
    const allStudents = [
      ...classStudents,
      ...recordedStudents.filter((s): s is StudentRecord => s !== undefined),
    ];
    return buildRoster(classStudents, allStudents, records, locale);
  }, [db, lessonId, classId, locale]);
}

const attendanceTables = (db: LocalDb) => [db.attendance, db.outbox, db.rejected, db.meta];

/** Records (or changes) a student's status in a lesson. The excuse note is kept. */
export async function setAttendance(
  store: LocalStore,
  lessonId: string,
  studentId: string,
  status: AttendanceStatus,
) {
  const id = attendanceIdFor(lessonId, studentId);
  const existing = await store.db.attendance.get(id);
  return store.upsert("attendance", id, {
    lessonId,
    studentId,
    status,
    excuseNote: existing?.excuseNote ?? "",
  });
}

export function setExcuseNote(
  store: LocalStore,
  lessonId: string,
  studentId: string,
  note: string,
) {
  return store.update("attendance", attendanceIdFor(lessonId, studentId), { excuseNote: note });
}

/** Back to "not marked" (soft delete; the same record is revived if marked again). */
export async function clearAttendance(store: LocalStore, lessonId: string, studentId: string) {
  const id = attendanceIdFor(lessonId, studentId);
  const existing = await store.db.attendance.get(id);
  if (existing && existing.deletedAt === null) await store.softDelete("attendance", id);
}

/**
 * Marks every not-yet-marked student present, in one transaction. Students
 * already marked absent or excused are left as they are.
 */
export async function markAllPresent(store: LocalStore, lessonId: string, studentIds: string[]) {
  const { db } = store;
  await db.transaction("rw", attendanceTables(db), async () => {
    for (const studentId of studentIds) {
      const existing = await db.attendance.get(attendanceIdFor(lessonId, studentId));
      if (!existing || existing.deletedAt !== null) {
        await setAttendance(store, lessonId, studentId, "present");
      }
    }
  });
}
