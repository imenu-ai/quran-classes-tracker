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

export const studentFieldsSchema = z.object({
  classId: idSchema,
  fullName: z.string().trim().min(1).max(NAME_MAX),
  birthYear: birthYearSchema,
  note: noteSchema(NOTE_MAX),
  memorizationDirection: z.enum(MEMORIZATION_DIRECTIONS),
});

export const studentRecordSchema = syncableBaseSchema.extend({
  ...studentFieldsSchema.shape,
  archivedAt: epochMsSchema.nullable(),
});

export type StudentRecord = z.infer<typeof studentRecordSchema>;
