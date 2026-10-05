import { z } from "zod";
import { validateAyahRange } from "@/domain/quran/validation";
import { idSchema, noteSchema, NOTE_MAX, syncableBaseSchema } from "./base";

export const RATE_MIN = 1;
export const RATE_MAX = 10;

export const rateSchema = z.number().int().min(RATE_MIN).max(RATE_MAX);

interface AyahRangeInput {
  surah: number;
  fromAyah: number;
  toAyah: number;
}

/**
 * Runs the sura map's validateAyahRange and reports its code on the right
 * field. Integer and range checks live there, so these fields are plain numbers.
 */
function refineAyahRange(value: AyahRangeInput, ctx: z.RefinementCtx) {
  const result = validateAyahRange(value.surah, value.fromAyah, value.toAyah);
  if (!result.ok) {
    ctx.addIssue({
      code: "custom",
      message: result.code,
      path: [result.field],
      params: result.params,
    });
  }
}

const ayahRangeFields = {
  surah: z.number(),
  fromAyah: z.number(),
  toAyah: z.number(),
};

/** Sura + ayah range alone, for the form's instant feedback. */
export const ayahRangeSchema = z.object(ayahRangeFields).superRefine(refineAyahRange);

export const homeworkFieldsSchema = z.object({
  studentId: idSchema,
  ...ayahRangeFields,
  note: noteSchema(NOTE_MAX),
  assignedLessonId: idSchema.nullable(),
  /** Pending while null. */
  evaluatedLessonId: idSchema.nullable(),
  memorizationRate: rateSchema.nullable(),
  behaviorRate: rateSchema.nullable(),
});

export const homeworkRecordSchema = syncableBaseSchema
  .extend(homeworkFieldsSchema.shape)
  .superRefine((homework, ctx) => {
    refineAyahRange(homework, ctx);
    const hasRate = homework.memorizationRate !== null || homework.behaviorRate !== null;
    if (hasRate && homework.evaluatedLessonId === null) {
      ctx.addIssue({
        code: "custom",
        message: "RATES_REQUIRE_EVALUATION",
        path: ["evaluatedLessonId"],
      });
    }
  });

export type HomeworkRecord = z.infer<typeof homeworkRecordSchema>;
