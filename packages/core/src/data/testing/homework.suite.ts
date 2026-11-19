import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { attendanceIdFor } from "../../shared/ids";
import { NOT_MEMORIZED } from "../../shared/schemas/homework";
import { lessonRecord } from "../../test/records";
import { LocalStore, LocalValidationError } from "../local-store";
import { setAttendance } from "../entities/attendance";
import {
  addExam,
  addHomework,
  rateHomework,
  setStudentAttendance,
  undoEvaluation,
  updateHomework,
} from "../entities/homework";
import type { LocalDatabase } from "../database";
import { openTestDevice, putRecords, type StorageFactory, type TestDevice } from "./harness";

export function homeworkSuite(factory: StorageFactory) {
  const LESSON = "01928c5e-7b3a-7cde-8f00-00000000aa01";
  const OLD_LESSON = "01928c5e-7b3a-7cde-8f00-00000000aa00";
  /** Between the two: a day he didn't know the homework given in OLD_LESSON. */
  const MIDDLE_LESSON = "01928c5e-7b3a-7cde-8f00-00000000aa02";
  const CLASS = "01928c5e-7b3a-7cde-8f00-00000000cc01";
  const STUDENT = "01928c5e-7b3a-7cde-8f00-00000000bb01";

  describe("homework actions", () => {
    let device: TestDevice;
    let db: LocalDatabase;
    let store: LocalStore;

    beforeEach(async () => {
      device = await openTestDevice(factory, { tenantId: "t1", deviceId: "d1", now: Date.now });
      ({ db, store } = device);
      await putRecords(db, "lessons", [
        lessonRecord(CLASS, { id: LESSON }),
        lessonRecord(CLASS, { id: OLD_LESSON, date: "2026-10-01" }),
        lessonRecord(CLASS, { id: MIDDLE_LESSON, date: "2026-10-03" }),
      ]);
    });

    afterEach(async () => {
      await device.destroy();
    });

    const assignInOldLesson = () =>
      addHomework(store, {
        studentId: STUDENT,
        lessonId: OLD_LESSON,
        portions: [{ surah: 78, fromAyah: 1, toAyah: 10 }],
        note: "",
        evaluateNow: false,
      });

    it("not memorized: still pending, no marks, the student present", async () => {
      const item = await assignInOldLesson();
      await rateHomework(store, item, LESSON, "memorizationRate", NOT_MEMORIZED);
      await rateHomework(store, item, LESSON, "memorizationRate", NOT_MEMORIZED); // counts once
      expect(await db.get("homework", item.id)).toMatchObject({
        evaluatedLessonId: null,
        memorizationRate: null,
        behaviorRate: null,
        notMemorized: [{ lessonId: LESSON, behaviorRate: null }],
      });
      expect(await db.get("attendance", attendanceIdFor(LESSON, STUDENT))).toMatchObject({
        status: "present",
      });

      // Clearing the memorization picker undoes it.
      await rateHomework(store, item, LESSON, "memorizationRate", null);
      expect((await db.get("homework", item.id))?.notMemorized).toEqual([]);
    });

    it("keeps the behavior mark of a not-memorized day in its entry", async () => {
      const item = await assignInOldLesson();
      await rateHomework(store, item, LESSON, "memorizationRate", NOT_MEMORIZED);
      await rateHomework(store, item, LESSON, "behaviorRate", 8.5);
      expect(await db.get("homework", item.id)).toMatchObject({
        evaluatedLessonId: null,
        behaviorRate: null,
        notMemorized: [{ lessonId: LESSON, behaviorRate: 8.5 }],
      });
    });

    it("a mark replaces not memorized in that lesson, keeping its behavior mark", async () => {
      const item = await assignInOldLesson();
      await rateHomework(store, item, MIDDLE_LESSON, "memorizationRate", NOT_MEMORIZED);
      await rateHomework(store, item, LESSON, "memorizationRate", NOT_MEMORIZED);
      await rateHomework(store, item, LESSON, "behaviorRate", 9);
      await rateHomework(store, item, LESSON, "memorizationRate", 7);
      expect(await db.get("homework", item.id)).toMatchObject({
        evaluatedLessonId: LESSON,
        memorizationRate: 7,
        behaviorRate: 9,
        // The earlier day stays in his history.
        notMemorized: [{ lessonId: MIDDLE_LESSON, behaviorRate: null }],
      });
    });

    it("choosing not memorized after marking takes the marks back, keeping behavior", async () => {
      const item = await assignInOldLesson();
      await rateHomework(store, item, LESSON, "memorizationRate", 4);
      await rateHomework(store, item, LESSON, "behaviorRate", 10);
      await rateHomework(store, item, LESSON, "memorizationRate", NOT_MEMORIZED);
      expect(await db.get("homework", item.id)).toMatchObject({
        evaluatedLessonId: null,
        memorizationRate: null,
        behaviorRate: null,
        notMemorized: [{ lessonId: LESSON, behaviorRate: 10 }],
      });
    });

    it("a failed day takes only a behavior mark once he recited it later", async () => {
      const item = await assignInOldLesson();
      // Not memorized in the middle lesson, recited in the new one.
      await rateHomework(store, item, MIDDLE_LESSON, "memorizationRate", NOT_MEMORIZED);
      await rateHomework(store, item, LESSON, "memorizationRate", 9);
      await rateHomework(store, item, MIDDLE_LESSON, "behaviorRate", 6);
      await rateHomework(store, item, MIDDLE_LESSON, "memorizationRate", 3); // ignored
      expect(await db.get("homework", item.id)).toMatchObject({
        evaluatedLessonId: LESSON,
        memorizationRate: 9,
        notMemorized: [{ lessonId: MIDDLE_LESSON, behaviorRate: 6 }],
      });
    });

    it("never marks an exam or homework for the next lesson not memorized", async () => {
      const exam = await addExam(store, {
        studentId: STUDENT,
        lessonId: LESSON,
        portions: [{ surah: 67, fromAyah: 1, toAyah: 10 }],
        note: "",
      });
      await rateHomework(store, exam, LESSON, "memorizationRate", NOT_MEMORIZED);
      expect(await db.get("homework", exam.id)).toMatchObject({
        evaluatedLessonId: LESSON,
        notMemorized: [],
      });

      const next = await addHomework(store, {
        studentId: STUDENT,
        lessonId: LESSON,
        portions: [{ surah: 78, fromAyah: 1, toAyah: 5 }],
        note: "",
        evaluateNow: false,
      });
      await rateHomework(store, next, LESSON, "memorizationRate", NOT_MEMORIZED);
      expect(await db.get("homework", next.id)).toMatchObject({
        evaluatedLessonId: null,
        notMemorized: [],
      });
    });

    const reciteNow = () =>
      addHomework(store, {
        studentId: STUDENT,
        lessonId: LESSON,
        portions: [{ surah: 78, fromAyah: 1, toAyah: 5 }],
        note: "",
        evaluateNow: true,
      });

    it("'recite now' can be not memorized: then due next lesson, with its behavior mark", async () => {
      const item = await reciteNow();
      await rateHomework(store, item, LESSON, "behaviorRate", 7);
      await rateHomework(store, item, LESSON, "memorizationRate", NOT_MEMORIZED);
      expect(await db.get("homework", item.id)).toMatchObject({
        assignedLessonId: LESSON,
        evaluatedLessonId: null,
        memorizationRate: null,
        behaviorRate: null,
        notMemorized: [{ lessonId: LESSON, behaviorRate: 7 }],
      });
    });

    it("clearing not memorized on 'recite now' makes it 'recite now' again", async () => {
      const item = await reciteNow();
      await rateHomework(store, item, LESSON, "memorizationRate", NOT_MEMORIZED);
      await rateHomework(store, item, LESSON, "behaviorRate", 6.5);
      await rateHomework(store, item, LESSON, "memorizationRate", null);
      expect(await db.get("homework", item.id)).toMatchObject({
        evaluatedLessonId: LESSON,
        memorizationRate: null,
        behaviorRate: 6.5,
        notMemorized: [],
      });
    });

    it("a mark of 0 on 'recite now' replaces not memorized", async () => {
      const item = await reciteNow();
      await rateHomework(store, item, LESSON, "memorizationRate", NOT_MEMORIZED);
      await rateHomework(store, item, LESSON, "memorizationRate", 0);
      expect(await db.get("homework", item.id)).toMatchObject({
        evaluatedLessonId: LESSON,
        memorizationRate: 0,
        notMemorized: [],
      });
    });

    it("undo removes a not-memorized 'recite now' item", async () => {
      const item = await reciteNow();
      await rateHomework(store, item, LESSON, "memorizationRate", NOT_MEMORIZED);
      const current = await db.get("homework", item.id);
      await undoEvaluation(store, current!, LESSON);
      expect((await db.get("homework", item.id))?.deletedAt).not.toBeNull();
    });

    it("records an exam on the spot: marked present, one mark, undo removes it", async () => {
      const exam = await addExam(store, {
        studentId: STUDENT,
        lessonId: LESSON,
        portions: [{ surah: 67, fromAyah: 1, toAyah: 10 }],
        note: "",
      });
      expect(exam).toMatchObject({
        kind: "exam",
        assignedLessonId: LESSON,
        evaluatedLessonId: LESSON,
        memorizationRate: null,
        behaviorRate: null,
      });
      expect(await db.get("attendance", attendanceIdFor(LESSON, STUDENT))).toMatchObject({
        status: "present",
      });
      await rateHomework(store, exam, LESSON, "memorizationRate", 6);
      expect((await db.get("homework", exam.id))?.memorizationRate).toBe(6);
      await expect(rateHomework(store, exam, LESSON, "behaviorRate", 6)).rejects.toThrow();

      await undoEvaluation(store, (await db.get("homework", exam.id))!, LESSON);
      expect((await db.get("homework", exam.id))?.deletedAt).not.toBeNull();
    });

    it("marking the student absent removes his not-memorized entry in that lesson", async () => {
      const item = await assignInOldLesson();
      await rateHomework(store, item, MIDDLE_LESSON, "memorizationRate", NOT_MEMORIZED);
      await rateHomework(store, item, LESSON, "memorizationRate", NOT_MEMORIZED);
      await rateHomework(store, item, LESSON, "behaviorRate", 5);
      await setStudentAttendance(store, LESSON, STUDENT, "absent");
      expect((await db.get("homework", item.id))?.notMemorized).toEqual([
        { lessonId: MIDDLE_LESSON, behaviorRate: null },
      ]);
      expect(await db.get("attendance", attendanceIdFor(LESSON, STUDENT))).toMatchObject({
        status: "absent",
      });
    });

    it("assigns homework for the next lesson as pending", async () => {
      const item = await assignInOldLesson();
      expect(item).toMatchObject({
        assignedLessonId: OLD_LESSON,
        evaluatedLessonId: null,
        memorizationRate: null,
      });
    });

    it("rating evaluates the item in this lesson and marks an unmarked student present", async () => {
      const item = await assignInOldLesson();
      await rateHomework(store, item, LESSON, "memorizationRate", 9);
      await rateHomework(store, item, LESSON, "behaviorRate", 10);
      expect(await db.get("homework", item.id)).toMatchObject({
        evaluatedLessonId: LESSON,
        memorizationRate: 9,
        behaviorRate: 10,
      });
      expect(await db.get("attendance", attendanceIdFor(LESSON, STUDENT))).toMatchObject({
        status: "present",
      });
    });

    it("does not override an existing attendance status", async () => {
      await setAttendance(store, LESSON, STUDENT, "excused");
      const item = await assignInOldLesson();
      await rateHomework(store, item, LESSON, "memorizationRate", 7);
      expect(await db.get("attendance", attendanceIdFor(LESSON, STUDENT))).toMatchObject({
        status: "excused",
      });
    });

    it("clears one score with null and keeps the item evaluated", async () => {
      const item = await assignInOldLesson();
      await rateHomework(store, item, LESSON, "memorizationRate", 9);
      await rateHomework(store, item, LESSON, "memorizationRate", null);
      expect(await db.get("homework", item.id)).toMatchObject({
        evaluatedLessonId: LESSON,
        memorizationRate: null,
      });
    });

    it("'recite now' creates an item evaluated in this lesson", async () => {
      const item = await addHomework(store, {
        studentId: STUDENT,
        lessonId: LESSON,
        portions: [{ surah: 114, fromAyah: 1, toAyah: 6 }],
        note: "",
        evaluateNow: true,
      });
      expect(item).toMatchObject({ assignedLessonId: LESSON, evaluatedLessonId: LESSON });
      expect(await db.get("attendance", attendanceIdFor(LESSON, STUDENT))).toMatchObject({
        status: "present",
      });
    });

    it("undo returns pending homework to pending and removes a 'recite now' item", async () => {
      const pending = await assignInOldLesson();
      await rateHomework(store, pending, LESSON, "memorizationRate", 9);
      await undoEvaluation(store, (await db.get("homework", pending.id))!, LESSON);
      expect(await db.get("homework", pending.id)).toMatchObject({
        evaluatedLessonId: null,
        memorizationRate: null,
        behaviorRate: null,
      });

      const recited = await addHomework(store, {
        studentId: STUDENT,
        lessonId: LESSON,
        portions: [{ surah: 114, fromAyah: 1, toAyah: 6 }],
        note: "",
        evaluateNow: true,
      });
      await undoEvaluation(store, recited, LESSON);
      expect((await db.get("homework", recited.id))?.deletedAt).not.toBeNull();
    });

    it("edits the portion and rejects an invalid ayah range locally", async () => {
      const item = await assignInOldLesson();
      const two = [
        { surah: 78, fromAyah: 1, toAyah: 5 },
        { surah: 79, fromAyah: 1, toAyah: 46 },
      ];
      await updateHomework(store, item.id, two, "");
      expect(await db.get("homework", item.id)).toMatchObject({ portions: two });
      const error = await updateHomework(
        store,
        item.id,
        [
          { surah: 78, fromAyah: 1, toAyah: 5 },
          { surah: 108, fromAyah: 1, toAyah: 5 },
        ],
        "",
      ).catch((e: unknown) => e);
      expect((error as LocalValidationError).errors[0]?.code).toBe("AYAH_OUT_OF_RANGE");
    });
  });
}
