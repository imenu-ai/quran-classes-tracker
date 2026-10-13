import { z } from "zod";
import {
  epochMsSchema,
  idSchema,
  NAME_MAX,
  noteSchema,
  NOTE_MAX,
  syncableBaseSchema,
} from "./base";

export const BIRTH_YEAR_MIN = 1900;

export const MEMORIZATION_DIRECTIONS = ["forward", "backward"] as const;
export type MemorizationDirection = (typeof MEMORIZATION_DIRECTIONS)[number];

/** Birth year between 1900 and the current year (checked at parse time). */
export const birthYearSchema = z
  .number()
  .int()
  .min(BIRTH_YEAR_MIN)
  .superRefine((year, ctx) => {
    const maximum = new Date().getUTCFullYear();
    if (year > maximum) {
      ctx.addIssue({ code: "too_big", origin: "number", maximum, inclusive: true, input: year });
    }
  });

/**
 * The parent's ID number as typed: Arabic-Indic (٠–٩) and Persian (۰–۹)
 * digits become ASCII; spaces, dashes, dots and direction marks go.
 */
export function normalizeParentId(input: string): string {
  return input
    .replace(/[\u0660-\u0669]/g, (digit) => String(digit.charCodeAt(0) - 0x0660))
    .replace(/[\u06f0-\u06f9]/g, (digit) => String(digit.charCodeAt(0) - 0x06f0))
    .replace(/[\s\-.\u200e\u200f]/g, "");
}

/**
 * The parent's ID number (رقم الهوية), which opens the student's parent link:
 * "" (not set) or 5–20 digits. Stored as entered (not hashed), by decision:
 * it's compared on the server and shown to whoever edits the student.
 */
export const parentIdSchema = z.string().regex(/^(|[0-9]{5,20})$/);

export const studentFieldsSchema = z.object({
  classId: idSchema,
  fullName: z.string().trim().min(1).max(NAME_MAX),
  birthYear: birthYearSchema,
  note: noteSchema(NOTE_MAX),
  memorizationDirection: z.enum(MEMORIZATION_DIRECTIONS),
  // Phase 14; older records and pushes have none.
  parentId: parentIdSchema.default(""),
});

export const studentRecordSchema = syncableBaseSchema.extend({
  ...studentFieldsSchema.shape,
  archivedAt: epochMsSchema.nullable(),
});

export type StudentRecord = z.infer<typeof studentRecordSchema>;
