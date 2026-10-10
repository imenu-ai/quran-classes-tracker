import { describe, expect, it } from "vitest";
import { attendanceRecord, homeworkRecord, lessonRecord } from "@/test/records";
import { buildMonthHistory } from "./profile";

const CLASS = "01928c5e-7b3a-7cde-8f00-0000000000c1";
const STUDENT = "01928c5e-7b3a-7cde-8f00-00000000bb01";

describe("buildMonthHistory", () => {
  const oct1 = lessonRecord(CLASS, { date: "2026-10-01" });
  const oct5 = lessonRecord(CLASS, { date: "2026-10-05" });
  const sep28 = lessonRecord(CLASS, { date: "2026-09-28" });
  const deleted = lessonRecord(CLASS, { date: "2026-10-03", deletedAt: 9 });
  const lessons = new Map([oct1, oct5, sep28, deleted].map((l) => [l.id, l]));

  it("lists the month's evaluations and absences, newest first", () => {
    const homework = [
      homeworkRecord(STUDENT, { evaluatedLessonId: oct1.id, memorizationRate: 8, behaviorRate: 9 }),
      homeworkRecord(STUDENT, { evaluatedLessonId: oct5.id, memorizationRate: 9, behaviorRate: 9 }),
      homeworkRecord(STUDENT, {
        evaluatedLessonId: sep28.id,
        memorizationRate: 7,
        behaviorRate: 7,
      }),
      homeworkRecord(STUDENT), // pending
      homeworkRecord(STUDENT, {
        evaluatedLessonId: deleted.id,
        memorizationRate: 1,
        behaviorRate: 1,
      }),
    ];
    const attendance = [
      attendanceRecord(oct5.id, STUDENT, { status: "present" }),
      attendanceRecord(oct1.id, STUDENT, { status: "excused", excuseNote: "مريض" }),
      attendanceRecord(sep28.id, STUDENT, { status: "absent" }),
    ];

    const rows = buildMonthHistory(homework, attendance, lessons, "2026-10");
    expect(
      rows.map((row) => [
        row.lesson.date,
        row.kind,
        row.kind === "absence" ? row.record.excuseNote : row.item.memorizationRate,
      ]),
    ).toEqual([
      ["2026-10-05", "evaluation", 9],
      ["2026-10-01", "evaluation", 8],
      ["2026-10-01", "absence", "مريض"],
    ]);
  });

  it("lists postponed recitations on their day, between evaluations and absences", () => {
    const homework = [
      homeworkRecord(STUDENT, { evaluatedLessonId: oct5.id, memorizationRate: 9 }),
      homeworkRecord(STUDENT, { postponedLessonIds: [oct1.id, oct5.id, sep28.id] }),
      homeworkRecord(STUDENT, { postponedLessonIds: [oct1.id], deletedAt: 5 }),
    ];
    const attendance = [attendanceRecord(oct5.id, STUDENT, { status: "excused" })];
    const rows = buildMonthHistory(homework, attendance, lessons, "2026-10");
    expect(rows.map((row) => [row.lesson.date, row.kind])).toEqual([
      ["2026-10-05", "evaluation"],
      ["2026-10-05", "postponed"],
      ["2026-10-05", "absence"],
      ["2026-10-01", "postponed"],
    ]);
  });

  it("is empty for a month without records", () => {
    expect(buildMonthHistory([], [], lessons, "2026-08")).toEqual([]);
  });
});
