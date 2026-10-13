import { z } from "zod";

/*
 * The parent page (Phase 14): a student's month for his parent, from the
 * server, opened with the parent's ID number. Shared by the API and the page.
 */

/** "YYYY-MM". */
export const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

export const parentRequestSchema = z.object({
  studentId: z.string().min(1).max(64),
  /** As typed; the server normalizes it. Absent: the remembered-phone cookie. */
  parentId: z.string().max(64).optional(),
  /** Absent: the current month in the center's time zone. */
  month: z.string().regex(MONTH_PATTERN).optional(),
});

export type ParentRequest = z.infer<typeof parentRequestSchema>;

export type ParentRowKind = "homework" | "exam" | "postponed" | "absent" | "excused";

/** One row of the month, without any internal id or teacher's note. */
export interface ParentRow {
  /** "YYYY-MM-DD". */
  date: string;
  kind: ParentRowKind;
  /** The portion (null on an absence). */
  surah: number | null;
  fromAyah: number | null;
  toAyah: number | null;
  /** An exam's one mark is `memorization`. */
  memorization: number | null;
  behavior: number | null;
  /** An absence's excuse ("" otherwise). */
  excuseNote: string;
}

export interface ParentReport {
  centerName: string;
  className: string;
  studentName: string;
  /** The month shown, "YYYY-MM". */
  month: string;
  /** Months with records, plus the current one; newest first. */
  months: string[];
  /** Oldest day first. */
  rows: ParentRow[];
  memorizationAverage: number | null;
  behaviorAverage: number | null;
  counts: {
    present: number;
    absent: number;
    excused: number;
    evaluated: number;
    exams: number;
    postponed: number;
  };
}

export type ParentError =
  | "INVALID_REQUEST"
  | "INVALID_LINK"
  | "PARENT_ID_REQUIRED"
  | "WRONG_PARENT_ID"
  | "TOO_MANY_ATTEMPTS"
  | "RATE_LIMITED";

/** The remembered-phone cookie, one per student (a parent may have several). */
export const parentCookieName = (studentId: string) => `qct_parent_${studentId}`;

/** The link a parent opens (and the printed QR code holds). */
export function parentLink(origin: string, studentId: string) {
  return `${origin}/parent?s=${encodeURIComponent(studentId)}`;
}
