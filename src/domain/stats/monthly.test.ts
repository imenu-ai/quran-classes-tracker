import { describe, expect, it } from "vitest";
import { monthlyStats } from "./monthly";

const lesson = (id: string, date: string, deletedAt: number | null = null) => ({
  id,
  date,
  deletedAt,
});
const hw = (
  evaluatedLessonId: string | null,
  memorizationRate: number | null,
  behaviorRate: number | null,
  deletedAt: number | null = null,
) => ({ evaluatedLessonId, memorizationRate, behaviorRate, deletedAt });
const att = (
  lessonId: string,
  status: "present" | "absent" | "excused",
  deletedAt: number | null = null,
) => ({ lessonId, status, deletedAt });

const lessons = [
  lesson("sep-28", "2026-09-28"),
  lesson("oct-01", "2026-10-01"),
  lesson("oct-05", "2026-10-05"),
  lesson("oct-31", "2026-10-31"),
];

describe("monthlyStats", () => {
  it("groups by the month of the lesson where the item was evaluated, newest first", () => {
    const stats = monthlyStats(
      [hw("sep-28", 8, 9), hw("oct-01", 9, 10), hw("oct-31", 7, 8)],
      [],
      lessons,
    );
    expect(stats.map((s) => [s.month, s.evaluatedCount])).toEqual([
      ["2026-10", 2],
      ["2026-09", 1],
    ]);
  });

  it("averages to one decimal and ignores missing scores", () => {
    const [october] = monthlyStats(
      [hw("oct-01", 9, 10), hw("oct-05", 8, null), hw("oct-31", 8, 7)],
      [],
      lessons,
    );
    expect(october).toMatchObject({
      memorizationAverage: 8.3, // (9+8+8)/3 = 8.333…
      behaviorAverage: 8.5, // (10+7)/2
      evaluatedCount: 3,
    });
  });

  it("gives null averages when a month has evaluations without scores", () => {
    const [october] = monthlyStats([hw("oct-01", null, null)], [att("oct-01", "present")], lessons);
    expect(october).toMatchObject({
      memorizationAverage: null,
      behaviorAverage: null,
      evaluatedCount: 1,
      present: 1,
    });
  });

  it("counts attended, absent and excused days per month", () => {
    const stats = monthlyStats(
      [],
      [
        att("sep-28", "present"),
        att("oct-01", "present"),
        att("oct-05", "absent"),
        att("oct-31", "excused"),
      ],
      lessons,
    );
    expect(stats).toEqual([
      {
        month: "2026-10",
        memorizationAverage: null,
        behaviorAverage: null,
        evaluatedCount: 0,
        present: 1,
        absent: 1,
        excused: 1,
      },
      {
        month: "2026-09",
        memorizationAverage: null,
        behaviorAverage: null,
        evaluatedCount: 0,
        present: 1,
        absent: 0,
        excused: 0,
      },
    ]);
  });

  it("ignores pending items, deleted records and anything in a deleted lesson", () => {
    const withDeletedLesson = [...lessons, lesson("oct-10", "2026-10-10", 99)];
    const stats = monthlyStats(
      [hw(null, null, null), hw("oct-01", 1, 1, 5), hw("oct-10", 2, 2), hw("oct-05", 10, 10)],
      [att("oct-01", "present", 5), att("oct-10", "present")],
      withDeletedLesson,
    );
    expect(stats).toEqual([
      {
        month: "2026-10",
        memorizationAverage: 10,
        behaviorAverage: 10,
        evaluatedCount: 1,
        present: 0,
        absent: 0,
        excused: 0,
      },
    ]);
  });

  it("moves an item to another month when its lesson's date changes", () => {
    const moved = lessons.map((l) => (l.id === "oct-01" ? { ...l, date: "2026-09-30" } : l));
    const stats = monthlyStats([hw("oct-01", 9, 9)], [], moved);
    expect(stats.map((s) => s.month)).toEqual(["2026-09"]);
  });

  it("returns nothing without data", () => {
    expect(monthlyStats([], [], lessons)).toEqual([]);
  });
});
