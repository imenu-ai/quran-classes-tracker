import { attendanceIdFor } from "../../shared/ids";
import type { AttendanceRecord, AttendanceStatus } from "../../shared/schemas/attendance";
import type { StudentRecord } from "../../shared/schemas/student";
import type { DataWriter } from "../local-store";
import type { StorageReader } from "../storage";
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

/**
 * The student's attendance record in a lesson: a live one if any (whatever
 * its id: imported or older data may not use the derived id), otherwise the
 * record at the derived id, possibly soft-deleted.
 */
export async function findAttendance(
  db: StorageReader,
  lessonId: string,
  studentId: string,
): Promise<AttendanceRecord | undefined> {
  const records = (await db.query("attendance", "lessonId", { equals: lessonId })).filter(
    (record) => record.studentId === studentId,
  );
  return (
    records.find((record) => record.deletedAt === null) ??
    records.find((record) => record.id === attendanceIdFor(lessonId, studentId))
  );
}

/** Records (or changes) a student's status in a lesson. The excuse note is kept. */
export function setAttendance(
  store: DataWriter,
  lessonId: string,
  studentId: string,
  status: AttendanceStatus,
) {
  return store.transaction(async (tx) => {
    const existing = await findAttendance(tx, lessonId, studentId);
    const lesson = await tx.get("lessons", lessonId);
    if (!lesson) throw new Error(`No lesson ${lessonId}`);
    return tx.upsert("attendance", existing?.id ?? attendanceIdFor(lessonId, studentId), {
      lessonId,
      classId: lesson.classId,
      studentId,
      status,
      excuseNote: existing?.excuseNote ?? "",
    });
  });
}

export async function setExcuseNote(
  store: DataWriter,
  lessonId: string,
  studentId: string,
  note: string,
) {
  await store.transaction(async (tx) => {
    const existing = await findAttendance(tx, lessonId, studentId);
    if (existing) await tx.update("attendance", existing.id, { excuseNote: note });
  });
}

/** Back to "not marked" (soft delete; the same record is revived if marked again). */
export async function clearAttendance(store: DataWriter, lessonId: string, studentId: string) {
  await store.transaction(async (tx) => {
    const existing = await findAttendance(tx, lessonId, studentId);
    if (existing && existing.deletedAt === null) await tx.softDelete("attendance", existing.id);
  });
}

/**
 * Marks every not-yet-marked student present, in one transaction. Students
 * already marked absent or excused are left as they are.
 */
export async function markAllPresent(store: DataWriter, lessonId: string, studentIds: string[]) {
  await store.transaction(async (tx) => {
    for (const studentId of studentIds) {
      const existing = await findAttendance(tx, lessonId, studentId);
      if (!existing || existing.deletedAt !== null) {
        await setAttendance(tx, lessonId, studentId, "present");
      }
    }
  });
}
