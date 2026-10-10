import { describe, expect, it } from "vitest";
import {
  attendanceRecordSchema,
  ayahRangeSchema,
  classRecordSchema,
  homeworkRecordSchema,
  lessonRecordSchema,
  parseWithCodes,
  studentRecordSchema,
  type FieldError,
} from "@/shared/schemas";

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
  it("fills in postponedLessonIds for a record from before Phase 9", () => {
    const result = parseWithCodes(homeworkRecordSchema, validHomework);
    expect(result.success && result.data.postponedLessonIds).toEqual([]);
    expect(
      parseWithCodes(homeworkRecordSchema, { ...validHomework, postponedLessonIds: ["nope"] })
        .success,
    ).toBe(false);
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
    [{ surah: 115 }, { path: "surah", code: "SURAH_NOT_FOUND", params: {} }],
    [{ fromAyah: 0 }, { path: "fromAyah", code: "INVALID_AYAH", params: {} }],
    [{ toAyah: 2.5 }, { path: "toAyah", code: "INVALID_AYAH", params: {} }],
    [
      { toAyah: 287 },
      { path: "toAyah", code: "AYAH_OUT_OF_RANGE", params: { surah: 2, ayahCount: 286 } },
    ],
    [
      { fromAyah: 9, toAyah: 3 },
      { path: "toAyah", code: "FROM_AFTER_TO", params: { fromAyah: 9, toAyah: 3 } },
    ],
  ])("rejects %o with the ayah range code", (patch, expected) => {
    expect(errorsOf(homeworkRecordSchema, { ...validHomework, ...patch })).toEqual([expected]);
  });

  it("rejects scores outside 1–10", () => {
    const evaluated = { ...validHomework, evaluatedLessonId: ID2 };
    expect(errorsOf(homeworkRecordSchema, { ...evaluated, memorizationRate: 11 })).toEqual([
      { path: "memorizationRate", code: "TOO_LARGE", params: { maximum: 10 } },
    ]);
    expect(errorsOf(homeworkRecordSchema, { ...evaluated, behaviorRate: 0 })).toEqual([
      { path: "behaviorRate", code: "TOO_SMALL", params: { minimum: 1 } },
    ]);
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
