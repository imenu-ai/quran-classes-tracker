import { v7 as uuidv7 } from "uuid";
import type { SyncRecordMap } from "../shared/sync/tables";

/** Builders for valid test records. Override any field. */

const base = (overrides: { id?: string; updatedAt?: number; updatedBy?: string } = {}) => ({
  id: overrides.id ?? uuidv7(),
  tenantId: "client-supplied-tenant",
  createdAt: 1_000,
  updatedAt: overrides.updatedAt ?? 1_000,
  updatedBy: overrides.updatedBy ?? "device-a",
  deletedAt: null,
  serverVersion: 0,
});

export const classRecord = (
  overrides: Partial<SyncRecordMap["classes"]> = {},
): SyncRecordMap["classes"] => ({
  ...base(overrides),
  name: "حلقة الفجر",
  archivedAt: null,
  ...overrides,
});

export const studentRecord = (
  classId: string,
  overrides: Partial<SyncRecordMap["students"]> = {},
): SyncRecordMap["students"] => ({
  ...base(overrides),
  classId,
  fullName: "أحمد",
  birthYear: 2014,
  note: "",
  memorizationDirection: "forward",
  parentId: "",
  archivedAt: null,
  ...overrides,
});

export const lessonRecord = (
  classId: string,
  overrides: Partial<SyncRecordMap["lessons"]> = {},
): SyncRecordMap["lessons"] => ({
  ...base(overrides),
  classId,
  date: "2026-10-05",
  note: "",
  ...overrides,
});

export const attendanceRecord = (
  lessonId: string,
  studentId: string,
  overrides: Partial<SyncRecordMap["attendance"]> = {},
): SyncRecordMap["attendance"] => ({
  ...base(overrides),
  lessonId,
  // Pass the lesson's class when pushing to the server (it's checked there).
  classId: "01900000-0000-7000-8000-000000000000",
  studentId,
  status: "present",
  excuseNote: "",
  ...overrides,
});

/**
 * A homework record (النبأ 1–10 by default). For a one-sura portion, tests
 * may pass `surah`, `fromAyah` and `toAyah` instead of `portions`.
 */
export const homeworkRecord = (
  studentId: string,
  overrides: Partial<SyncRecordMap["homework"]> & {
    surah?: number;
    fromAyah?: number;
    toAyah?: number;
  } = {},
): SyncRecordMap["homework"] => {
  const { surah = 78, fromAyah = 1, toAyah = 10, ...rest } = overrides;
  return {
    ...base(rest),
    studentId,
    portions: [{ surah, fromAyah, toAyah }],
    note: "",
    assignedLessonId: null,
    evaluatedLessonId: null,
    memorizationRate: null,
    behaviorRate: null,
    notMemorized: [],
    kind: "homework",
    ...rest,
  };
};
