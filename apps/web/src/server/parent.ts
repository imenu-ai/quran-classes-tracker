import { createHmac, timingSafeEqual } from "node:crypto";
import type { Db } from "mongodb";
import { monthKey, todayInTimeZone } from "@/domain/dates/local-date";
import {
  buildMonthSheet,
  buildStudentProfile,
  referencedLessonIds,
  type HistoryRow,
} from "@/domain/stats/month-sheet";
import { DEFAULT_TIME_ZONE } from "@/i18n/config";
import type { ParentError, ParentReport, ParentRow } from "@/shared/parent";
import type { AttendanceRecord } from "@/shared/schemas/attendance";
import { isExam, type HomeworkRecord } from "@/shared/schemas/homework";
import type { LessonRecord } from "@/shared/schemas/lesson";
import { normalizeParentId, type StudentRecord } from "@/shared/schemas/student";
import { COLLECTIONS } from "./collections";
import {
  consumeRateLimit,
  isRateLimited,
  PARENT_FAILURES_PER_IP,
  PARENT_FAILURES_PER_STUDENT,
  PARENT_RATE_LIMIT,
} from "./rate-limit";
import { createTenantRepositories, type TenantDocument } from "./repositories/tenant-repository";
import { getTenant } from "./tenants";

/** How long a phone stays remembered after the right ID number. */
export const PARENT_COOKIE_MAX_AGE = 30 * 24 * 60 * 60;

/**
 * The remembered-phone token: tied to the student and his current parent ID,
 * so changing the ID ends every remembered phone at once.
 */
export function parentToken(secret: string, studentId: string, parentId: string): string {
  return createHmac("sha256", secret).update(`parent:${studentId}:${parentId}`).digest("base64url");
}

function same(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export type ParentResult =
  | { ok: true; report: ParentReport; token: string }
  | { ok: false; status: number; error: ParentError };

const fail = (status: number, error: ParentError): ParentResult => ({ ok: false, status, error });

function toRecord<T>({ _id, ...fields }: TenantDocument): T {
  return { id: _id, ...fields } as unknown as T;
}

/**
 * A student's month for his parent. The parent proves himself with the ID
 * number (`parentId`) or a token from an earlier visit (`token`, the
 * cookie). Wrong numbers are limited per IP and per student; an unknown,
 * deleted or unset student gets the same "invalid link" answer.
 */
export async function parentReport(
  db: Db,
  input: {
    studentId: string;
    parentId?: string;
    token?: string;
    month?: string;
    ip: string;
    secret: string;
    now?: number;
  },
): Promise<ParentResult> {
  const now = input.now ?? Date.now();
  if (!(await consumeRateLimit(db, `parent:ip:${input.ip}`, PARENT_RATE_LIMIT, now))) {
    return fail(429, "RATE_LIMITED");
  }

  // By id in any center: the link carries nothing else.
  const studentDoc = await db
    .collection<TenantDocument>(COLLECTIONS.students)
    .findOne({ _id: input.studentId });
  const expected = typeof studentDoc?.parentId === "string" ? studentDoc.parentId : "";
  if (!studentDoc || studentDoc.deletedAt !== null || expected === "") {
    return fail(404, "INVALID_LINK");
  }

  if (input.parentId !== undefined) {
    const failures = {
      ip: `parent-fail:ip:${input.ip}`,
      student: `parent-fail:student:${input.studentId}`,
    };
    // Once over a limit, not even the right number is checked.
    if (
      (await isRateLimited(db, failures.ip, PARENT_FAILURES_PER_IP, now)) ||
      (await isRateLimited(db, failures.student, PARENT_FAILURES_PER_STUDENT, now))
    ) {
      return fail(429, "TOO_MANY_ATTEMPTS");
    }
    if (!same(normalizeParentId(input.parentId), expected)) {
      await consumeRateLimit(db, failures.ip, PARENT_FAILURES_PER_IP, now);
      await consumeRateLimit(db, failures.student, PARENT_FAILURES_PER_STUDENT, now);
      return fail(401, "WRONG_PARENT_ID");
    }
  } else if (
    !input.token ||
    !same(input.token, parentToken(input.secret, input.studentId, expected))
  ) {
    return fail(401, "PARENT_ID_REQUIRED");
  }

  const student = toRecord<StudentRecord>(studentDoc);
  const repos = createTenantRepositories(db, studentDoc.tenantId);
  const [homeworkDocs, attendanceDocs, classDoc, tenant] = await Promise.all([
    repos.homework.find({ studentId: student.id }).toArray(),
    repos.attendance.find({ studentId: student.id }).toArray(),
    repos.classes.findById(student.classId),
    getTenant(db, studentDoc.tenantId),
  ]);
  const homework = homeworkDocs.map((doc) => toRecord<HomeworkRecord>(doc));
  const attendance = attendanceDocs.map((doc) => toRecord<AttendanceRecord>(doc));
  const lessonIds = referencedLessonIds(
    homework.filter((h) => h.deletedAt === null),
    attendance.filter((a) => a.deletedAt === null),
  );
  const lessons = (await repos.lessons.find({ _id: { $in: lessonIds } }).toArray()).map((doc) =>
    toRecord<LessonRecord>(doc),
  );

  const profile = buildStudentProfile(homework, attendance, lessons);
  const current = monthKey(todayInTimeZone(tenant?.timezone ?? DEFAULT_TIME_ZONE, new Date(now)));
  const month = input.month ?? current;
  const sheet = buildMonthSheet(student, profile, month);
  const months = [...new Set([current, month, ...profile.months.map((m) => m.month)])].sort(
    (a, b) => b.localeCompare(a),
  );

  return {
    ok: true,
    token: parentToken(input.secret, input.studentId, expected),
    report: {
      centerName: tenant?.name ?? "",
      className: typeof classDoc?.name === "string" ? classDoc.name : "",
      studentName: student.fullName,
      month,
      months,
      rows: sheet.rows.map(toParentRow),
      memorizationAverage: sheet.memorizationAverage,
      behaviorAverage: sheet.behaviorAverage,
      counts: sheet.counts,
    },
  };
}

/** A month row as the parent sees it: no ids, no teacher's notes. */
function toParentRow(row: HistoryRow): ParentRow {
  if (row.kind === "absence") {
    return {
      date: row.lesson.date,
      kind: row.record.status === "excused" ? "excused" : "absent",
      surah: null,
      fromAyah: null,
      toAyah: null,
      memorization: null,
      behavior: null,
      excuseNote: row.record.excuseNote,
    };
  }
  const portion = { surah: row.item.surah, fromAyah: row.item.fromAyah, toAyah: row.item.toAyah };
  if (row.kind === "postponed") {
    return {
      date: row.lesson.date,
      kind: "postponed",
      ...portion,
      memorization: null,
      behavior: null,
      excuseNote: "",
    };
  }
  const exam = isExam(row.item);
  return {
    date: row.lesson.date,
    kind: exam ? "exam" : "homework",
    ...portion,
    memorization: row.item.memorizationRate,
    behavior: exam ? null : row.item.behaviorRate,
    excuseNote: "",
  };
}
