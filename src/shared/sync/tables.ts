import type { z } from "zod";
import { attendanceRecordSchema, type AttendanceRecord } from "../schemas/attendance";
import { classRecordSchema, type ClassRecord } from "../schemas/class";
import { homeworkRecordSchema, type HomeworkRecord } from "../schemas/homework";
import { lessonRecordSchema, type LessonRecord } from "../schemas/lesson";
import { studentRecordSchema, type StudentRecord } from "../schemas/student";

/**
 * Every syncable table. The names are shared by Dexie (client), the sync
 * protocol and MongoDB (server collections).
 */
export const SYNC_TABLES = ["classes", "students", "lessons", "attendance", "homework"] as const;

export type SyncTable = (typeof SYNC_TABLES)[number];

export interface SyncRecordMap {
  classes: ClassRecord;
  students: StudentRecord;
  lessons: LessonRecord;
  attendance: AttendanceRecord;
  homework: HomeworkRecord;
}

export type SyncRecord = SyncRecordMap[SyncTable];

export const RECORD_SCHEMAS: { [T in SyncTable]: z.ZodType<SyncRecordMap[T]> } = {
  classes: classRecordSchema,
  students: studentRecordSchema,
  lessons: lessonRecordSchema,
  attendance: attendanceRecordSchema,
  homework: homeworkRecordSchema,
};

export interface Reference {
  field: string;
  table: SyncTable;
}

/**
 * Foreign keys. The server checks each one exists in the same tenant before
 * accepting a record (nullable references are only checked when set).
 */
export const REFERENCES: Record<SyncTable, readonly Reference[]> = {
  classes: [],
  students: [{ field: "classId", table: "classes" }],
  lessons: [{ field: "classId", table: "classes" }],
  attendance: [
    { field: "lessonId", table: "lessons" },
    { field: "studentId", table: "students" },
  ],
  homework: [
    { field: "studentId", table: "students" },
    { field: "assignedLessonId", table: "lessons" },
    { field: "evaluatedLessonId", table: "lessons" },
  ],
};

export function isSyncTable(value: unknown): value is SyncTable {
  return typeof value === "string" && (SYNC_TABLES as readonly string[]).includes(value);
}
