import { z } from "zod";
import { PAGE_COUNT, portionsMatchPages } from "../../domain/quran/pages";
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

/** One sura and its ayah range: a homework holds one or more of these. */
export const ayahRangeSchema = z.object(ayahRangeFields).superRefine(refineAyahRange);

export type HomeworkPortion = z.infer<typeof ayahRangeSchema>;

/** At most one portion per sura of the Quran. */
export const PORTIONS_MAX = 114;

const pageSchema = z.number().int().min(1).max(PAGE_COUNT);

/** Whole pages of the Madinah Mushaf, from page to page (the same for one). */
export const pageRangeSchema = z.object({ from: pageSchema, to: pageSchema });

export type PageRange = z.infer<typeof pageRangeSchema>;

export const notMemorizedEntrySchema = z.object({
  lessonId: idSchema,
  behaviorRate: rateSchema.nullable(),
});

export type NotMemorizedEntry = z.infer<typeof notMemorizedEntrySchema>;

export const homeworkFieldsSchema = z.object({
  studentId: idSchema,
  /**
   * The suras it covers, in the order given, each with its ayah range; one
   * mark for all of them. Read through portionsOf(): records from before
   * Phase 3 have surah/fromAyah/toAyah instead.
   */
  portions: z.array(ayahRangeSchema).min(1).max(PORTIONS_MAX),
  /**
   * Set when it was given as whole pages: the portions are then exactly those
   * pages' suras and ayahs, and it shows as pages. Null for ayah ranges, and
   * after the ayahs are edited. Defaults to null for records from before Phase 3.
   */
  pages: pageRangeSchema.nullable().default(null),
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
 * A record from before Phase 3 has one sura in surah/fromAyah/toAyah, and
 * lists its postponements in postponedLessonIds (they became "not memorized"
 * without a behavior mark). Parsing converts both, so the first write of an
 * old record (on a device, or pushed by one) keeps them.
 */
function fromPhase2(input: unknown): unknown {
  if (typeof input !== "object" || input === null) return input;
  let record = input as Record<string, unknown>;
  if (record.portions === undefined && record.surah !== undefined) {
    const { surah, fromAyah, toAyah, ...rest } = record;
    record = { ...rest, portions: [{ surah, fromAyah, toAyah }] };
  }
  if (record.notMemorized === undefined && Array.isArray(record.postponedLessonIds)) {
    const { postponedLessonIds, ...rest } = record;
    record = {
      ...rest,
      notMemorized: (postponedLessonIds as unknown[]).map((lessonId) => ({
        lessonId,
        behaviorRate: null,
      })),
    };
  }
  return record;
}

const currentHomeworkRecordSchema = syncableBaseSchema
  .extend(homeworkFieldsSchema.shape)
  .superRefine((homework, ctx) => {
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
    // The pages hold exactly these portions.
    if (
      homework.pages !== null &&
      (homework.pages.from > homework.pages.to ||
        !portionsMatchPages(homework.portions, homework.pages.from, homework.pages.to))
    ) {
      ctx.addIssue({ code: "custom", message: "INVALID_VALUE", path: ["pages"] });
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

export const homeworkRecordSchema = z.preprocess(fromPhase2, currentHomeworkRecordSchema);

export type HomeworkRecord = z.infer<typeof currentHomeworkRecordSchema>;

/** "homework" or "exam" (records pulled from before Phase 12 lack the field). */
export const kindOf = (item: { kind?: HomeworkKind }): HomeworkKind => item.kind ?? "homework";

export const isExam = (item: { kind?: HomeworkKind }) => kindOf(item) === "exam";

/**
 * The suras of a homework item. Records pulled from the server aren't
 * re-validated, so one from before Phase 3 may have a single
 * surah/fromAyah/toAyah instead.
 */
export function portionsOf(item: {
  portions?: readonly HomeworkPortion[];
  surah?: number;
  fromAyah?: number;
  toAyah?: number;
}): readonly HomeworkPortion[] {
  if (item.portions) return item.portions;
  if (item.surah === undefined || item.fromAyah === undefined || item.toAyah === undefined) {
    return [];
  }
  return [{ surah: item.surah, fromAyah: item.fromAyah, toAyah: item.toAyah }];
}

/** The page range it was given as (records from before Phase 3 lack the field). */
export const pagesOf = (item: { pages?: PageRange | null }): PageRange | null => item.pages ?? null;

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
