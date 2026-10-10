import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { attendanceIdFor } from "@/shared/ids";
import { lessonRecord } from "@/test/records";
import { openLocalDb, type LocalDb } from "../db/dexie";
import { LocalStore, LocalValidationError } from "../db/local-store";
import { setAttendance } from "./attendance";
import { addHomework, rateHomework, undoEvaluation, updateHomework } from "./homework";

const LESSON = "01928c5e-7b3a-7cde-8f00-00000000aa01";
const OLD_LESSON = "01928c5e-7b3a-7cde-8f00-00000000aa00";
const CLASS = "01928c5e-7b3a-7cde-8f00-00000000cc01";
const STUDENT = "01928c5e-7b3a-7cde-8f00-00000000bb01";

describe("homework actions", () => {
  let db: LocalDb;
  let store: LocalStore;

  beforeEach(async () => {
    db = openLocalDb(`homework-${crypto.randomUUID()}`);
    store = new LocalStore(db, { tenantId: "t1", deviceId: "d1" });
    await db.lessons.bulkPut([
      lessonRecord(CLASS, { id: LESSON }),
      lessonRecord(CLASS, { id: OLD_LESSON, date: "2026-10-01" }),
    ]);
  });

  afterEach(async () => {
    await db.delete();
  });

  const assignInOldLesson = () =>
    addHomework(store, {
      studentId: STUDENT,
      lessonId: OLD_LESSON,
      portion: { surah: 78, fromAyah: 1, toAyah: 10 },
      note: "",
      evaluateNow: false,
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
    expect(await db.homework.get(item.id)).toMatchObject({
      evaluatedLessonId: LESSON,
      memorizationRate: 9,
      behaviorRate: 10,
    });
    expect(await db.attendance.get(attendanceIdFor(LESSON, STUDENT))).toMatchObject({
      status: "present",
    });
  });

  it("does not override an existing attendance status", async () => {
    await setAttendance(store, LESSON, STUDENT, "excused");
    const item = await assignInOldLesson();
    await rateHomework(store, item, LESSON, "memorizationRate", 7);
    expect(await db.attendance.get(attendanceIdFor(LESSON, STUDENT))).toMatchObject({
      status: "excused",
    });
  });

  it("clears one score with null and keeps the item evaluated", async () => {
    const item = await assignInOldLesson();
    await rateHomework(store, item, LESSON, "memorizationRate", 9);
    await rateHomework(store, item, LESSON, "memorizationRate", null);
    expect(await db.homework.get(item.id)).toMatchObject({
      evaluatedLessonId: LESSON,
      memorizationRate: null,
    });
  });

  it("'recite now' creates an item evaluated in this lesson", async () => {
    const item = await addHomework(store, {
      studentId: STUDENT,
      lessonId: LESSON,
      portion: { surah: 114, fromAyah: 1, toAyah: 6 },
      note: "",
      evaluateNow: true,
    });
    expect(item).toMatchObject({ assignedLessonId: LESSON, evaluatedLessonId: LESSON });
    expect(await db.attendance.get(attendanceIdFor(LESSON, STUDENT))).toMatchObject({
      status: "present",
    });
  });

  it("undo returns pending homework to pending and removes a 'recite now' item", async () => {
    const pending = await assignInOldLesson();
    await rateHomework(store, pending, LESSON, "memorizationRate", 9);
    await undoEvaluation(store, (await db.homework.get(pending.id))!, LESSON);
    expect(await db.homework.get(pending.id)).toMatchObject({
      evaluatedLessonId: null,
      memorizationRate: null,
      behaviorRate: null,
    });

    const recited = await addHomework(store, {
      studentId: STUDENT,
      lessonId: LESSON,
      portion: { surah: 114, fromAyah: 1, toAyah: 6 },
      note: "",
      evaluateNow: true,
    });
    await undoEvaluation(store, recited, LESSON);
    expect((await db.homework.get(recited.id))?.deletedAt).not.toBeNull();
  });

  it("edits the portion and rejects an invalid ayah range locally", async () => {
    const item = await assignInOldLesson();
    await updateHomework(store, item.id, { surah: 78, fromAyah: 1, toAyah: 5 }, "");
    expect(await db.homework.get(item.id)).toMatchObject({ toAyah: 5 });
    const error = await updateHomework(
      store,
      item.id,
      { surah: 108, fromAyah: 1, toAyah: 5 },
      "",
    ).catch((e: unknown) => e);
    expect((error as LocalValidationError).errors[0]?.code).toBe("AYAH_OUT_OF_RANGE");
  });
});
