import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  attendanceRecord,
  classRecord,
  homeworkRecord,
  lessonRecord,
  studentRecord,
} from "../../test/records";
import { buildMonthSheet, buildStudentProfile } from "../../domain/stats/month-sheet";
import { loadPrintSheets } from "../entities/print";
import type { LocalDatabase } from "../database";
import { openTestDevice, putRecords, type StorageFactory, type TestDevice } from "./harness";

export function printSuite(factory: StorageFactory) {
  const cls = classRecord();
  const other = classRecord({ name: "حلقة العصر" });
  const ahmad = studentRecord(cls.id, { fullName: "أحمد" });
  const salem = studentRecord(cls.id, { fullName: "سالم" });
  const elsewhere = studentRecord(other.id, { fullName: "خالد" });

  const oct1 = lessonRecord(cls.id, { date: "2026-10-01" });
  const oct2 = lessonRecord(cls.id, { date: "2026-10-02" });
  const oct5 = lessonRecord(cls.id, { date: "2026-10-05" });
  const sep30 = lessonRecord(cls.id, { date: "2026-09-30" });
  const lessons = [oct1, oct2, oct5, sep30];

  const homework = [
    homeworkRecord(ahmad.id, {
      surah: 112,
      evaluatedLessonId: oct1.id,
      memorizationRate: 9,
      behaviorRate: 10,
    }),
    // An exam: counted on its own, outside the averages.
    homeworkRecord(ahmad.id, {
      kind: "exam",
      surah: 67,
      assignedLessonId: oct5.id,
      evaluatedLessonId: oct5.id,
      memorizationRate: 3,
    }),
    // Not memorized on 5 Oct (still pending); that day's behavior mark counts.
    homeworkRecord(ahmad.id, {
      surah: 113,
      assignedLessonId: oct2.id,
      notMemorized: [{ lessonId: oct5.id, behaviorRate: 8 }],
    }),
    // Another month.
    homeworkRecord(ahmad.id, {
      surah: 111,
      evaluatedLessonId: sep30.id,
      memorizationRate: 2,
      behaviorRate: 2,
    }),
  ];
  const attendance = [
    attendanceRecord(oct1.id, ahmad.id),
    attendanceRecord(oct2.id, ahmad.id, { status: "excused", excuseNote: "سفر" }),
    attendanceRecord(oct5.id, ahmad.id),
  ];

  describe("buildMonthSheet", () => {
    it("lists the month oldest first, with averages without exams and every count", () => {
      const sheet = buildMonthSheet(
        ahmad,
        buildStudentProfile(homework, attendance, lessons),
        "2026-10",
      );
      expect(sheet.rows.map((row) => [row.lesson.date, row.kind])).toEqual([
        ["2026-10-01", "evaluation"],
        ["2026-10-02", "absence"],
        ["2026-10-05", "evaluation"],
        ["2026-10-05", "notMemorized"],
      ]);
      // Behavior: (10 + the "not memorized" day's 8) / 2.
      expect(sheet).toMatchObject({ memorizationAverage: 9, behaviorAverage: 9 });
      expect(sheet.counts).toEqual({
        present: 2,
        absent: 0,
        excused: 1,
        evaluated: 1,
        exams: 1,
        notMemorized: 1,
      });
    });

    it("gives an empty month no rows, no averages and zero counts", () => {
      const sheet = buildMonthSheet(
        ahmad,
        buildStudentProfile(homework, attendance, lessons),
        "2026-11",
      );
      expect(sheet).toMatchObject({
        rows: [],
        memorizationAverage: null,
        behaviorAverage: null,
        counts: { present: 0, absent: 0, excused: 0, evaluated: 0, exams: 0, notMemorized: 0 },
      });
    });
  });

  describe("loadPrintSheets", () => {
    let device: TestDevice;
    let db: LocalDatabase;

    beforeEach(async () => {
      device = await openTestDevice(factory);
      ({ db } = device);
      await putRecords(db, "classes", [cls, other]);
      await putRecords(db, "students", [ahmad, salem, elsewhere]);
      await putRecords(db, "lessons", lessons);
      await putRecords(db, "homework", homework);
      await putRecords(db, "attendance", attendance);
    });

    afterEach(async () => {
      await device.destroy();
    });

    it("builds a sheet per student, in the order asked, only for the class's students", async () => {
      const result = await loadPrintSheets(
        db,
        cls.id,
        [salem.id, elsewhere.id, ahmad.id, "missing", salem.id],
        "2026-10",
      );
      expect(result?.cls.id).toBe(cls.id);
      expect(result?.sheets.map((sheet) => sheet.student.fullName)).toEqual(["سالم", "أحمد"]);
      expect(result?.sheets[0]?.rows).toEqual([]);
      expect(result?.sheets[1]?.counts).toMatchObject({ evaluated: 1, exams: 1, notMemorized: 1 });
    });

    it("returns null for a class that doesn't exist", async () => {
      expect(await loadPrintSheets(db, "missing", [ahmad.id], "2026-10")).toBeNull();
    });
  });
}
