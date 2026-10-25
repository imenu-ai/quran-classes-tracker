import { validate, version } from "uuid";
import { describe, expect, it } from "vitest";
import { attendanceIdFor, lessonIdFor } from "./ids";

const CLASS_A = "01928c5e-7b3a-7cde-8f00-0000000000a1";
const CLASS_B = "01928c5e-7b3a-7cde-8f00-0000000000b2";

describe("deterministic ids", () => {
  it("gives the same lesson id for the same class and date (any device)", () => {
    expect(lessonIdFor(CLASS_A, "2026-10-05")).toBe(lessonIdFor(CLASS_A, "2026-10-05"));
  });

  it("differs by class and by date", () => {
    const ids = new Set([
      lessonIdFor(CLASS_A, "2026-10-05"),
      lessonIdFor(CLASS_A, "2026-10-06"),
      lessonIdFor(CLASS_B, "2026-10-05"),
    ]);
    expect(ids.size).toBe(3);
  });

  it("is a valid UUIDv5 accepted by the record schemas", () => {
    const id = lessonIdFor(CLASS_A, "2026-10-05");
    expect(validate(id)).toBe(true);
    expect(version(id)).toBe(5);
  });

  it("gives one attendance id per lesson and student", () => {
    const lesson = lessonIdFor(CLASS_A, "2026-10-05");
    expect(attendanceIdFor(lesson, "s1")).toBe(attendanceIdFor(lesson, "s1"));
    expect(attendanceIdFor(lesson, "s1")).not.toBe(attendanceIdFor(lesson, "s2"));
    expect(attendanceIdFor(lesson, "s1")).not.toBe(lessonIdFor(CLASS_A, "2026-10-05"));
  });
});
