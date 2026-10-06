import { describe, expect, it } from "vitest";
import { evaluationProgress, splitLessonHomework } from "./progress";

const LESSON = "L-today";

const hw = (
  id: string,
  studentId: string,
  overrides: Partial<{
    evaluatedLessonId: string | null;
    assignedLessonId: string | null;
    memorizationRate: number | null;
    behaviorRate: number | null;
    deletedAt: number | null;
  }> = {},
) => ({
  id,
  studentId,
  evaluatedLessonId: null,
  assignedLessonId: null,
  memorizationRate: null,
  behaviorRate: null,
  deletedAt: null,
  ...overrides,
});

describe("evaluationProgress", () => {
  it("counts present students whose items evaluated today all have both scores", () => {
    const homework = [
      hw("1", "a", { evaluatedLessonId: LESSON, memorizationRate: 9, behaviorRate: 10 }),
      hw("2", "b", { evaluatedLessonId: LESSON, memorizationRate: 8, behaviorRate: null }),
      hw("3", "c"), // still pending, not recited today
      hw("4", "d", { evaluatedLessonId: LESSON, memorizationRate: 7, behaviorRate: 7 }),
      hw("5", "d", { evaluatedLessonId: LESSON, memorizationRate: 7, behaviorRate: null }),
      hw("6", "e", { evaluatedLessonId: "other-lesson", memorizationRate: 7, behaviorRate: 7 }),
    ];
    expect(evaluationProgress(["a", "b", "c", "d", "e"], homework, LESSON)).toEqual({
      done: 1,
      total: 5,
    });
  });

  it("a pending item not recited today doesn't hold a student back", () => {
    const homework = [
      hw("1", "a", { evaluatedLessonId: LESSON, memorizationRate: 9, behaviorRate: 9 }),
      hw("2", "a"),
    ];
    expect(evaluationProgress(["a"], homework, LESSON)).toEqual({ done: 1, total: 1 });
  });

  it("ignores deleted items and absent students", () => {
    const homework = [
      hw("1", "a", {
        evaluatedLessonId: LESSON,
        memorizationRate: 9,
        behaviorRate: 9,
        deletedAt: 1,
      }),
      hw("2", "absent", { evaluatedLessonId: LESSON, memorizationRate: 9, behaviorRate: 9 }),
    ];
    expect(evaluationProgress(["a"], homework, LESSON)).toEqual({ done: 0, total: 1 });
  });
});

describe("splitLessonHomework", () => {
  const dates = new Map([
    ["L-old", "2026-10-01"],
    [LESSON, "2026-10-05"],
    ["L-later", "2026-10-08"],
  ]);
  const lesson = { id: LESSON, date: "2026-10-05" };

  it("separates what to recite, what was evaluated here, and next homework", () => {
    const items = [
      hw("pending-old", "a", { assignedLessonId: "L-old" }),
      hw("pending-unassigned", "a"),
      hw("recited-here", "a", { assignedLessonId: "L-old", evaluatedLessonId: LESSON }),
      hw("recite-now", "a", { assignedLessonId: LESSON, evaluatedLessonId: LESSON }),
      hw("next", "a", { assignedLessonId: LESSON }),
      hw("assigned-later", "a", { assignedLessonId: "L-later" }),
      hw("evaluated-elsewhere", "a", { assignedLessonId: "L-old", evaluatedLessonId: "L-old" }),
      hw("deleted", "a", { assignedLessonId: "L-old", deletedAt: 3 }),
    ];
    const split = splitLessonHomework(items, lesson, dates);
    expect(split.toRecite.map((i) => i.id)).toEqual(["pending-old", "pending-unassigned"]);
    expect(split.evaluatedHere.map((i) => i.id)).toEqual(["recited-here", "recite-now"]);
    expect(split.nextHomework.map((i) => i.id)).toEqual(["next"]);
  });
});
