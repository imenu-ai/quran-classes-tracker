import { describe, expect, it } from "vitest";
import {
  attendanceRecordSchema,
  ayahRangeSchema,
  classRecordSchema,
  homeworkRecordSchema,
  lessonRecordSchema,
  parseWithCodes,
  normalizeParentId,
  RATE_VALUES,
  rateSchema,
  studentRecordSchema,
  type FieldError,
} from ".";

const ID = "01928c5e-7b3a-7cde-8f00-0123456789ab";
const ID2 = "01928c5e-7b3a-7cde-8f00-0123456789ac";

const base = {
  id: ID,
  tenantId: "tenant-1",
  createdAt: 1_760_000_000_000,
  updatedAt: 1_760_000_000_000,
  updatedBy: "device-1",
  deletedAt: null,
  serverVersion: 0,
};

/** One sura in the pre-Phase 3 form (surah/fromAyah/toAyah), which parsing converts. */
const validHomework = {
  ...base,
  studentId: ID2,
  surah: 2,
  fromAyah: 1,
  toAyah: 5,
  note: "",
  assignedLessonId: null,
  evaluatedLessonId: null,
  memorizationRate: null,
  behaviorRate: null,
};

function errorsOf(schema: Parameters<typeof parseWithCodes>[0], input: unknown): FieldError[] {
  const result = parseWithCodes(schema, input);
  if (result.success) throw new Error("expected a validation failure");
  return result.errors;
}

describe("parseWithCodes", () => {
  it("returns parsed data on success (with trimmed strings)", () => {
    const result = parseWithCodes(classRecordSchema, {
      ...base,
      name: "  حلقة الفجر ",
      archivedAt: null,
    });
    expect(result).toEqual({
      success: true,
      data: { ...base, name: "حلقة الفجر", archivedAt: null },
    });
  });

  it("reports codes, never text", () => {
    expect(errorsOf(classRecordSchema, { ...base, name: "   ", archivedAt: null })).toEqual([
      { path: "name", code: "REQUIRED", params: { minimum: 1 } },
    ]);
    expect(
      errorsOf(classRecordSchema, { ...base, name: "x".repeat(61), archivedAt: null }),
    ).toEqual([{ path: "name", code: "TOO_LONG", params: { maximum: 60 } }]);
  });

  it("maps missing fields to REQUIRED and bad ids to INVALID_FORMAT", () => {
    const errors = errorsOf(classRecordSchema, { ...base, id: "nope", archivedAt: null });
    expect(errors).toContainEqual({ path: "id", code: "INVALID_FORMAT", params: {} });
    expect(errors).toContainEqual({ path: "name", code: "REQUIRED", params: {} });
  });
});

describe("studentRecordSchema", () => {
  const student = {
    ...base,
    classId: ID2,
    fullName: "Ahmad أحمد",
    birthYear: 2014,
    note: "",
    memorizationDirection: "forward",
    archivedAt: null,
  };

  it("accepts a valid student", () => {
    expect(parseWithCodes(studentRecordSchema, student).success).toBe(true);
  });

  it("rejects a birth year in the future or before 1900", () => {
    const nextYear = new Date().getUTCFullYear() + 1;
    expect(errorsOf(studentRecordSchema, { ...student, birthYear: nextYear })).toEqual([
      { path: "birthYear", code: "TOO_LARGE", params: { maximum: nextYear - 1 } },
    ]);
    expect(errorsOf(studentRecordSchema, { ...student, birthYear: 1899 })).toEqual([
      { path: "birthYear", code: "TOO_SMALL", params: { minimum: 1900 } },
    ]);
    expect(errorsOf(studentRecordSchema, { ...student, birthYear: 2014.5 })).toEqual([
      { path: "birthYear", code: "NOT_INTEGER", params: {} },
    ]);
  });

  it("rejects an unknown memorization direction", () => {
    expect(errorsOf(studentRecordSchema, { ...student, memorizationDirection: "up" })).toEqual([
      { path: "memorizationDirection", code: "INVALID_VALUE", params: {} },
    ]);
  });

  it("takes a parent ID of 5–20 digits or none, and fills in none for older records", () => {
    const parsed = parseWithCodes(studentRecordSchema, student);
    expect(parsed.success && parsed.data.parentId).toBe("");
    for (const good of ["12345", "123456789", "12345678901234567890"]) {
      expect(parseWithCodes(studentRecordSchema, { ...student, parentId: good }).success).toBe(
        true,
      );
    }
    for (const bad of ["1234", "123456789012345678901", "12a456", " 123456", "١٢٣٤٥"]) {
      expect(errorsOf(studentRecordSchema, { ...student, parentId: bad })).toEqual([
        { path: "parentId", code: "INVALID_FORMAT", params: {} },
      ]);
    }
  });

  it("normalizes a typed parent ID", () => {
    expect(normalizeParentId("١٢٣ ٤٥٦-٧٨٩")).toBe("123456789");
    expect(normalizeParentId("۱۲۳۴۵")).toBe("12345");
    expect(normalizeParentId(" 40 123.456 ")).toBe("40123456");
    expect(normalizeParentId("")).toBe("");
  });
});

describe("lessonRecordSchema", () => {
  const lesson = { ...base, classId: ID2, date: "2026-10-05", note: "" };

  it("accepts a valid lesson", () => {
    expect(parseWithCodes(lessonRecordSchema, lesson).success).toBe(true);
  });

  it.each(["2026-02-30", "2026-1-5", "05-10-2026", ""])("rejects date %s", (date) => {
    expect(errorsOf(lessonRecordSchema, { ...lesson, date })).toEqual([
      { path: "date", code: "INVALID_FORMAT", params: {} },
    ]);
  });
});

describe("attendanceRecordSchema", () => {
  it("accepts each status and rejects others", () => {
    for (const status of ["present", "absent", "excused"]) {
      const record = {
        ...base,
        lessonId: ID2,
        classId: ID2,
        studentId: ID2,
        status,
        excuseNote: "",
      };
      expect(parseWithCodes(attendanceRecordSchema, record).success).toBe(true);
    }
    const bad = {
      ...base,
      lessonId: ID2,
      classId: ID2,
      studentId: ID2,
      status: "late",
      excuseNote: "",
    };
    expect(errorsOf(attendanceRecordSchema, bad)).toEqual([
      { path: "status", code: "INVALID_VALUE", params: {} },
    ]);
  });
});

describe("homeworkRecordSchema", () => {
  it("fills in kind for a record from before Phase 12, and gives an exam one mark", () => {
    const result = parseWithCodes(homeworkRecordSchema, validHomework);
    expect(result.success && result.data.kind).toBe("homework");

    const exam = { ...validHomework, kind: "exam", evaluatedLessonId: ID2, memorizationRate: 7 };
    expect(parseWithCodes(homeworkRecordSchema, exam).success).toBe(true);
    expect(errorsOf(homeworkRecordSchema, { ...exam, behaviorRate: 7 })).toEqual([
      { path: "behaviorRate", code: "INVALID_VALUE", params: {} },
    ]);
  });

  it("fills in notMemorized, turning an older record's postponements into entries", () => {
    const result = parseWithCodes(homeworkRecordSchema, validHomework);
    expect(result.success && result.data.notMemorized).toEqual([]);
    const legacy = parseWithCodes(homeworkRecordSchema, {
      ...validHomework,
      postponedLessonIds: [ID2],
    });
    expect(legacy.success && legacy.data.notMemorized).toEqual([
      { lessonId: ID2, behaviorRate: null },
    ]);
    expect(legacy.success && "postponedLessonIds" in legacy.data).toBe(false);
    expect(
      parseWithCodes(homeworkRecordSchema, { ...validHomework, postponedLessonIds: ["nope"] })
        .success,
    ).toBe(false);
  });

  it("rejects not memorized on an exam, twice in a lesson, or where it was marked", () => {
    const entry = { lessonId: ID2, behaviorRate: 9.5 };
    expect(
      parseWithCodes(homeworkRecordSchema, { ...validHomework, notMemorized: [entry] }).success,
    ).toBe(true);
    const invalid = { path: "notMemorized", code: "INVALID_VALUE", params: {} };
    expect(
      errorsOf(homeworkRecordSchema, { ...validHomework, kind: "exam", notMemorized: [entry] }),
    ).toEqual([invalid]);
    expect(
      errorsOf(homeworkRecordSchema, { ...validHomework, notMemorized: [entry, entry] }),
    ).toEqual([invalid]);
    expect(
      errorsOf(homeworkRecordSchema, {
        ...validHomework,
        evaluatedLessonId: ID2,
        notMemorized: [entry],
      }),
    ).toEqual([invalid]);
  });

  it("turns an older record's single sura into portions", () => {
    const result = parseWithCodes(homeworkRecordSchema, validHomework);
    expect(result.success && result.data.portions).toEqual([{ surah: 2, fromAyah: 1, toAyah: 5 }]);
    expect(result.success && "surah" in result.data).toBe(false);
  });

  it("accepts several suras, and reports a bad one by its place in the list", () => {
    const { surah: _s, fromAyah: _f, toAyah: _t, ...rest } = validHomework;
    const two = [
      { surah: 67, fromAyah: 1, toAyah: 30 },
      { surah: 68, fromAyah: 1, toAyah: 15 },
    ];
    expect(parseWithCodes(homeworkRecordSchema, { ...rest, portions: two }).success).toBe(true);
    expect(
      errorsOf(homeworkRecordSchema, {
        ...rest,
        portions: [two[0], { surah: 68, fromAyah: 1, toAyah: 60 }],
      }),
    ).toEqual([
      {
        path: "portions.1.toAyah",
        code: "AYAH_OUT_OF_RANGE",
        params: { surah: 68, ayahCount: 52 },
      },
    ]);
    expect(errorsOf(homeworkRecordSchema, { ...rest, portions: [] })).toEqual([
      { path: "portions", code: "TOO_SMALL", params: { minimum: 1 } },
    ]);
  });

  it("keeps the page range only when the portions are exactly those pages", () => {
    const { surah: _s, fromAyah: _f, toAyah: _t, ...rest } = validHomework;
    const page293 = [
      { surah: 17, fromAyah: 105, toAyah: 111 },
      { surah: 18, fromAyah: 1, toAyah: 4 },
    ];
    const ok = parseWithCodes(homeworkRecordSchema, {
      ...rest,
      portions: page293,
      pages: { from: 293, to: 293 },
    });
    expect(ok.success && ok.data.pages).toEqual({ from: 293, to: 293 });
    // Records from before Phase 3 have no pages.
    const older = parseWithCodes(homeworkRecordSchema, validHomework);
    expect(older.success && older.data.pages).toBeNull();
    const invalid = [{ path: "pages", code: "INVALID_VALUE", params: {} }];
    expect(
      errorsOf(homeworkRecordSchema, {
        ...rest,
        portions: [page293[1]],
        pages: { from: 293, to: 293 },
      }),
    ).toEqual(invalid);
    expect(
      errorsOf(homeworkRecordSchema, { ...rest, portions: page293, pages: { from: 294, to: 293 } }),
    ).toEqual(invalid);
  });

  it("accepts a pending homework item", () => {
    expect(parseWithCodes(homeworkRecordSchema, validHomework).success).toBe(true);
  });

  it("accepts an evaluated item with one or both scores", () => {
    const evaluated = { ...validHomework, evaluatedLessonId: ID2 };
    expect(
      parseWithCodes(homeworkRecordSchema, { ...evaluated, memorizationRate: 9 }).success,
    ).toBe(true);
    expect(
      parseWithCodes(homeworkRecordSchema, { ...evaluated, memorizationRate: 10, behaviorRate: 1 })
        .success,
    ).toBe(true);
  });

  it.each([
    [{ surah: 115 }, { path: "portions.0.surah", code: "SURAH_NOT_FOUND", params: {} }],
    [{ fromAyah: 0 }, { path: "portions.0.fromAyah", code: "INVALID_AYAH", params: {} }],
    [{ toAyah: 2.5 }, { path: "portions.0.toAyah", code: "INVALID_AYAH", params: {} }],
    [
      { toAyah: 287 },
      {
        path: "portions.0.toAyah",
        code: "AYAH_OUT_OF_RANGE",
        params: { surah: 2, ayahCount: 286 },
      },
    ],
    [
      { fromAyah: 9, toAyah: 3 },
      { path: "portions.0.toAyah", code: "FROM_AFTER_TO", params: { fromAyah: 9, toAyah: 3 } },
    ],
  ])("rejects %o with the ayah range code", (patch, expected) => {
    expect(errorsOf(homeworkRecordSchema, { ...validHomework, ...patch })).toEqual([expected]);
  });

  it("accepts 0 and half marks", () => {
    const evaluated = { ...validHomework, evaluatedLessonId: ID2 };
    for (const [memorizationRate, behaviorRate] of [
      [0, 0],
      [9.5, 0.5],
      [10, 7.5],
    ]) {
      expect(
        parseWithCodes(homeworkRecordSchema, { ...evaluated, memorizationRate, behaviorRate })
          .success,
      ).toBe(true);
    }
  });

  it("rejects scores outside 0–10 or between halves", () => {
    const evaluated = { ...validHomework, evaluatedLessonId: ID2 };
    expect(errorsOf(homeworkRecordSchema, { ...evaluated, memorizationRate: 10.5 })).toEqual([
      { path: "memorizationRate", code: "TOO_LARGE", params: { maximum: 10 } },
    ]);
    expect(errorsOf(homeworkRecordSchema, { ...evaluated, behaviorRate: -0.5 })).toEqual([
      { path: "behaviorRate", code: "TOO_SMALL", params: { minimum: 0 } },
    ]);
    expect(errorsOf(homeworkRecordSchema, { ...evaluated, memorizationRate: 9.25 })).toEqual([
      { path: "memorizationRate", code: "INVALID", params: {} },
    ]);
  });

  it("offers every mark from 0 to 10 in halves", () => {
    expect(RATE_VALUES).toHaveLength(21);
    expect(RATE_VALUES.slice(0, 3)).toEqual([0, 0.5, 1]);
    expect(RATE_VALUES.at(-1)).toBe(10);
    for (const value of RATE_VALUES) expect(rateSchema.safeParse(value).success).toBe(true);
  });

  it("rejects scores on a pending item", () => {
    expect(errorsOf(homeworkRecordSchema, { ...validHomework, behaviorRate: 7 })).toEqual([
      { path: "evaluatedLessonId", code: "RATES_REQUIRE_EVALUATION", params: {} },
    ]);
  });
});

describe("ayahRangeSchema", () => {
  it("validates the range alone for instant form feedback", () => {
    expect(parseWithCodes(ayahRangeSchema, { surah: 1, fromAyah: 1, toAyah: 7 }).success).toBe(
      true,
    );
    expect(errorsOf(ayahRangeSchema, { surah: 1, fromAyah: 1, toAyah: 8 })).toEqual([
      { path: "toAyah", code: "AYAH_OUT_OF_RANGE", params: { surah: 1, ayahCount: 7 } },
    ]);
  });
});
