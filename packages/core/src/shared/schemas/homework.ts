import { z } from "zod";
import { validateAyahRange } from "../../domain/quran/validation";
import { idSchema, noteSchema, NOTE_MAX, syncableBaseSchema } from "./base";

export const RATE_MIN = 1;
export const RATE_MAX = 10;

export const rateSchema = z.number().int().min(RATE_MIN).max(RATE_MAX);

/**
 * homework: assigned (or recited on the spot) and marked for memorization
 * and behavior. exam: added and marked on the spot with ONE mark, stored in
 * memorizationRate; ignored in every average.
 */
export const HOMEWORK_KINDS = ["homework", "exam"] as const;
export type HomeworkKind = (typeof HOMEWORK_KINDS)[number];

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
  /**
   * Lessons in which the recitation was postponed ("تأجيل التسميع"): the
   * student wasn't ready, so it stays pending instead of getting a bad mark.
   * Defaults to [] so records from before Phase 9 stay valid.
   */
  postponedLessonIds: z.array(idSchema).max(200).default([]),
  /** Defaults to "homework" so records from before Phase 12 stay valid. */
  kind: z.enum(HOMEWORK_KINDS).default("homework"),
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
    // An exam has a single mark (memorizationRate).
    if (homework.kind === "exam" && homework.behaviorRate !== null) {
      ctx.addIssue({ code: "custom", message: "INVALID_VALUE", path: ["behaviorRate"] });
    }
  });

export type HomeworkRecord = z.infer<typeof homeworkRecordSchema>;

/** "homework" or "exam" (records pulled from before Phase 12 lack the field). */
export const kindOf = (item: { kind?: HomeworkKind }): HomeworkKind => item.kind ?? "homework";

export const isExam = (item: { kind?: HomeworkKind }) => kindOf(item) === "exam";

/** The lessons where this item was postponed (records pulled before Phase 9 lack the field). */
export const postponedLessonsOf = (item: Pick<HomeworkRecord, "postponedLessonIds">): string[] =>
  item.postponedLessonIds ?? [];
