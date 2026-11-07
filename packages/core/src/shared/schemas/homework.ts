import { z } from "zod";
import { validateAyahRange } from "../../domain/quran/validation";
import { idSchema, noteSchema, NOTE_MAX, syncableBaseSchema } from "./base";

export const RATE_MIN = 0;
export const RATE_MAX = 10;
/** Marks go in halves (9.5). 0 is a real mark, not "no mark". */
export const RATE_STEP = 0.5;

export const rateSchema = z.number().min(RATE_MIN).max(RATE_MAX).multipleOf(RATE_STEP);

/** Every mark a picker offers, lowest first: 0, 0.5 … 10. */
export const RATE_VALUES: readonly number[] = Array.from(
  { length: (RATE_MAX - RATE_MIN) / RATE_STEP + 1 },
  (_, i) => RATE_MIN + i * RATE_STEP,
);

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

export const notMemorizedEntrySchema = z.object({
  lessonId: idSchema,
  behaviorRate: rateSchema.nullable(),
});

export type NotMemorizedEntry = z.infer<typeof notMemorizedEntrySchema>;

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
   * Lessons in which the student hadn't memorized it ("لم يحفظ"): it stays
   * pending, with that day's behavior mark if he got one. Read through
   * notMemorizedOf(): records from before Phase 3 have postponedLessonIds.
   */
  notMemorized: z.array(notMemorizedEntrySchema).max(200).default([]),
  /** Defaults to "homework" so records from before Phase 12 stay valid. */
  kind: z.enum(HOMEWORK_KINDS).default("homework"),
});

/**
 * A record from before Phase 3 lists its postponements in postponedLessonIds
 * (they became "not memorized" without a behavior mark). Parsing converts
 * it, so the first write of an old record keeps them.
 */
function fromPostponed(input: unknown): unknown {
  if (typeof input !== "object" || input === null) return input;
  const record = input as Record<string, unknown>;
  if (record.notMemorized !== undefined || !Array.isArray(record.postponedLessonIds)) return input;
  const { postponedLessonIds, ...rest } = record;
  return {
    ...rest,
    notMemorized: (postponedLessonIds as unknown[]).map((lessonId) => ({
      lessonId,
      behaviorRate: null,
    })),
  };
}

const currentHomeworkRecordSchema = syncableBaseSchema
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
    // An exam is only marked; one lesson can't be both "not memorized" and marked.
    const lessons = homework.notMemorized.map((entry) => entry.lessonId);
    if (
      (homework.kind === "exam" && lessons.length > 0) ||
      new Set(lessons).size !== lessons.length ||
      (homework.evaluatedLessonId !== null && lessons.includes(homework.evaluatedLessonId))
    ) {
      ctx.addIssue({ code: "custom", message: "INVALID_VALUE", path: ["notMemorized"] });
    }
  });

export const homeworkRecordSchema = z.preprocess(fromPostponed, currentHomeworkRecordSchema);

export type HomeworkRecord = z.infer<typeof currentHomeworkRecordSchema>;

/** "homework" or "exam" (records pulled from before Phase 12 lack the field). */
export const kindOf = (item: { kind?: HomeworkKind }): HomeworkKind => item.kind ?? "homework";

export const isExam = (item: { kind?: HomeworkKind }) => kindOf(item) === "exam";

/** The value a memorization picker sets for "لم يحفظ". */
export const NOT_MEMORIZED = "notMemorized";

/** A memorization picker's value: a mark, no mark, or "not memorized". */
export type MemorizationChoice = number | null | typeof NOT_MEMORIZED;

/**
 * The lessons where he hadn't memorized it. Records pulled from the server
 * aren't re-validated, so an older one may still have postponedLessonIds
 * (read as entries without a behavior mark), or neither field.
 */
export function notMemorizedOf(item: {
  notMemorized?: readonly NotMemorizedEntry[];
  postponedLessonIds?: readonly string[];
}): readonly NotMemorizedEntry[] {
  if (item.notMemorized) return item.notMemorized;
  return (item.postponedLessonIds ?? []).map((lessonId) => ({ lessonId, behaviorRate: null }));
}

/** His "not memorized" entry in this lesson, if any. */
export const notMemorizedIn = (
  item: Parameters<typeof notMemorizedOf>[0],
  lessonId: string,
): NotMemorizedEntry | null =>
  notMemorizedOf(item).find((entry) => entry.lessonId === lessonId) ?? null;

type MarkedItem = Pick<
  HomeworkRecord,
  "kind" | "assignedLessonId" | "evaluatedLessonId" | "memorizationRate" | "behaviorRate"
> &
  Parameters<typeof notMemorizedOf>[0];

/** What the two pickers show for this item in this lesson. */
export function marksIn(
  item: MarkedItem,
  lessonId: string,
): { memorization: MemorizationChoice; behavior: number | null } {
  const entry = notMemorizedIn(item, lessonId);
  if (entry) return { memorization: NOT_MEMORIZED, behavior: entry.behaviorRate };
  if (item.evaluatedLessonId === lessonId) {
    return { memorization: item.memorizationRate, behavior: item.behaviorRate };
  }
  return { memorization: null, behavior: null };
}

/**
 * Which memorization choices this item takes in this lesson. "Not memorized"
 * is for due homework: never an exam, nor an item added in this lesson
 * (recited on the spot), nor one already recited in another lesson. Marks
 * can't be given in a lesson where he failed it if he recited it later.
 */
export function memorizationChoices(
  item: MarkedItem,
  lessonId: string,
): { marks: boolean; notMemorized: boolean } {
  const elsewhere = item.evaluatedLessonId !== null && item.evaluatedLessonId !== lessonId;
  return {
    marks: !elsewhere,
    notMemorized: !isExam(item) && item.assignedLessonId !== lessonId && !elsewhere,
  };
}
