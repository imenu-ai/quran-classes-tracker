import { attendanceIdFor } from "@/shared/ids";
import type { AttendanceRecord, AttendanceStatus } from "@/shared/schemas/attendance";
import type { StudentRecord } from "@/shared/schemas/student";
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

// Lessons are read (attendance takes its lesson's class), never written here.
const attendanceTables = (db: LocalDb) => [
  db.attendance,
  db.lessons,
  db.outbox,
  db.rejected,
  db.meta,
];

/**
 * The student's attendance record in a lesson: a live one if any (whatever
 * its id: imported or older data may not use the derived id), otherwise the
 * record at the derived id, possibly soft-deleted.
 */
export async function findAttendance(
  db: LocalDb,
  lessonId: string,
  studentId: string,
): Promise<AttendanceRecord | undefined> {
  const records = (await db.attendance.where("lessonId").equals(lessonId).toArray()).filter(
    (record) => record.studentId === studentId,
  );
  return (
    records.find((record) => record.deletedAt === null) ??
    records.find((record) => record.id === attendanceIdFor(lessonId, studentId))
  );
}

/** Records (or changes) a student's status in a lesson. The excuse note is kept. */
export async function setAttendance(
  store: LocalStore,
  lessonId: string,
  studentId: string,
  status: AttendanceStatus,
) {
  const existing = await findAttendance(store.db, lessonId, studentId);
  const lesson = await store.db.lessons.get(lessonId);
  if (!lesson) throw new Error(`No lesson ${lessonId}`);
  return store.upsert("attendance", existing?.id ?? attendanceIdFor(lessonId, studentId), {
    lessonId,
    classId: lesson.classId,
    studentId,
    status,
    excuseNote: existing?.excuseNote ?? "",
  });
}

export async function setExcuseNote(
  store: LocalStore,
  lessonId: string,
  studentId: string,
  note: string,
) {
  const existing = await findAttendance(store.db, lessonId, studentId);
  if (existing) await store.update("attendance", existing.id, { excuseNote: note });
}

/** Back to "not marked" (soft delete; the same record is revived if marked again). */
export async function clearAttendance(store: LocalStore, lessonId: string, studentId: string) {
  const existing = await findAttendance(store.db, lessonId, studentId);
  if (existing && existing.deletedAt === null) await store.softDelete("attendance", existing.id);
}

/**
 * Marks every not-yet-marked student present, in one transaction. Students
 * already marked absent or excused are left as they are.
 */
export async function markAllPresent(store: LocalStore, lessonId: string, studentIds: string[]) {
  const { db } = store;
  await db.transaction("rw", attendanceTables(db), async () => {
    for (const studentId of studentIds) {
      const existing = await findAttendance(db, lessonId, studentId);
      if (!existing || existing.deletedAt !== null) {
        await setAttendance(store, lessonId, studentId, "present");
      }
    }
  });
}
