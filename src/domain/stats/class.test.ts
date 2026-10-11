import { describe, expect, it } from "vitest";
import { ALL_TIME, classStatistics, inPeriod } from "./class";

const TZ = "Asia/Hebron";
const joined = (date: string) => Date.parse(`${date}T09:00:00Z`);

const students = [
  { id: "a", fullName: "أحمد", createdAt: joined("2026-09-01") },
  { id: "b", fullName: "بلال", createdAt: joined("2026-09-01") },
  { id: "c", fullName: "خالد", createdAt: joined("2026-10-03") }, // joined mid-October
  { id: "d", fullName: "زيد", createdAt: joined("2026-09-01") }, // never came
];
const lessons = [
  { id: "l1", date: "2026-09-28", deletedAt: null },
  { id: "l2", date: "2026-10-01", deletedAt: null },
  { id: "l3", date: "2026-10-05", deletedAt: null },
  { id: "gone", date: "2026-10-02", deletedAt: 5 },
];
const attendance = [
  { lessonId: "l1", studentId: "a", status: "present" as const, deletedAt: null },
  { lessonId: "l2", studentId: "a", status: "present" as const, deletedAt: null },
  { lessonId: "l3", studentId: "a", status: "present" as const, deletedAt: null },
  { lessonId: "l1", studentId: "b", status: "present" as const, deletedAt: null },
  { lessonId: "l2", studentId: "b", status: "excused" as const, deletedAt: null },
  { lessonId: "l3", studentId: "b", status: "absent" as const, deletedAt: null },
  { lessonId: "l3", studentId: "c", status: "present" as const, deletedAt: null },
  { lessonId: "gone", studentId: "d", status: "present" as const, deletedAt: null },
  { lessonId: "l1", studentId: "d", status: "present" as const, deletedAt: 9 },
];
const scored = (studentId: string, lessonId: string, memorization: number, behavior: number) => ({
  studentId,
  evaluatedLessonId: lessonId,
  memorizationRate: memorization,
  behaviorRate: behavior,
  deletedAt: null,
});
const homework = [
  scored("a", "l2", 8, 9),
  scored("a", "l3", 10, 10),
  scored("b", "l1", 10, 10),
  scored("c", "l3", 9, 6),
  // Postponed (pending, no marks), deleted, and in a deleted lesson: none count.
  {
    studentId: "a",
    evaluatedLessonId: null,
    memorizationRate: null,
    behaviorRate: null,
    deletedAt: null,
  },
  { ...scored("a", "l3", 1, 1), deletedAt: 3 },
  scored("d", "gone", 1, 1),
];

const stats = (period = ALL_TIME) =>
  classStatistics({ students, lessons, attendance, homework, period, timeZone: TZ, locale: "ar" });

describe("inPeriod", () => {
  it("matches all time, a year, or a month", () => {
    expect(inPeriod("2026-10-05", ALL_TIME)).toBe(true);
    expect(inPeriod("2026-10-05", { year: 2026, month: null })).toBe(true);
    expect(inPeriod("2026-10-05", { year: 2025, month: null })).toBe(false);
    expect(inPeriod("2026-10-05", { year: 2026, month: 10 })).toBe(true);
    expect(inPeriod("2026-10-05", { year: 2026, month: 9 })).toBe(false);
  });
});

describe("classStatistics", () => {
  it("counts an excused absence as attended, from the day each student joined", () => {
    const byId = Object.fromEntries(stats().students.map((s) => [s.studentId, s]));
    expect(byId.a).toMatchObject({ attended: 3, possible: 3, rate: 1 });
    expect(byId.b).toMatchObject({ present: 1, excused: 1, absent: 1, attended: 2, possible: 3 });
    expect(byId.b?.rate).toBeCloseTo(2 / 3);
    // Joined after the first two lessons: only the third counts.
    expect(byId.c).toMatchObject({ attended: 1, possible: 1, rate: 1 });
    // Deleted lessons and records don't count.
    expect(byId.d).toMatchObject({ attended: 0, possible: 3, rate: 0 });
  });

  it("ranks by attendance rate, then memorization, then behavior", () => {
    const result = stats();
    // a and c both attended every day and average 9.0 in memorization; a's
    // behavior (9.5) beats c's (6.0). Then b (67%), then d (0%).
    expect(result.students.map((s) => s.studentId)).toEqual(["a", "c", "b", "d"]);
    expect(result.students[0]).toMatchObject({ memorizationAverage: 9, behaviorAverage: 9.5 });
  });

  it("summarizes the class", () => {
    expect(stats()).toMatchObject({
      lessonDays: 3,
      present: 5,
      absent: 1,
      excused: 1,
      attended: 6,
      possible: 10,
      rate: 0.6,
      memorizationAverage: 9.3, // (8 + 10 + 10 + 9) / 4 = 9.25
      behaviorAverage: 8.8, // (9 + 10 + 10 + 6) / 4 = 8.75
    });
  });

  it("narrows to a month: students without scores rank after those with, none last", () => {
    const september = stats({ year: 2026, month: 9 });
    expect(september.lessonDays).toBe(1);
    // b: 1/1 with 10; a: 1/1 without marks that month; d: 0/1; c: not joined yet.
    expect(september.students.map((s) => [s.studentId, s.rate, s.memorizationAverage])).toEqual([
      ["b", 1, 10],
      ["a", 1, null],
      ["d", 0, null],
      ["c", null, null],
    ]);
  });

  it("is empty for a period without lessons", () => {
    const empty = stats({ year: 2025, month: null });
    expect(empty).toMatchObject({ lessonDays: 0, rate: null, memorizationAverage: null });
    expect(empty.students.every((s) => s.possible === 0)).toBe(true);
  });
});
