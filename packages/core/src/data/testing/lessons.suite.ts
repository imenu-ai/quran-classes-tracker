import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { lessonIdFor } from "../../shared/ids";
import { LocalStore } from "../local-store";
import { setAttendance } from "../entities/attendance";
import { addHomework, rateHomework } from "../entities/homework";
import { changeLessonDate, deleteLesson, findLiveLesson, startLesson } from "../entities/lessons";
import type { LocalDatabase } from "../database";
import { openTestDevice, type StorageFactory, type TestDevice } from "./harness";

export function lessonsSuite(factory: StorageFactory) {
  const CLASS_ID = "01928c5e-7b3a-7cde-8f00-0000000000c1";

  describe("lessons", () => {
    let device: TestDevice;
    let db: LocalDatabase;
    let store: LocalStore;

    beforeEach(async () => {
      device = await openTestDevice(factory, { tenantId: "t1", deviceId: "d1", now: Date.now });
      ({ db, store } = device);
    });

    afterEach(async () => {
      await device.destroy();
    });

    it("creates today's lesson with the derived id, and opens it again instead of duplicating", async () => {
      const first = await startLesson(store, CLASS_ID, "2026-10-05");
      expect(first.id).toBe(lessonIdFor(CLASS_ID, "2026-10-05"));
      const again = await startLesson(store, CLASS_ID, "2026-10-05");
      expect(again.id).toBe(first.id);
      expect(await db.count("lessons")).toBe(1);
    });

    it("two devices starting the same lesson offline produce the same id", async () => {
      const other = await openTestDevice(factory, { deviceId: "d2", now: Date.now });
      const mine = await startLesson(store, CLASS_ID, "2026-10-05");
      const theirs = await startLesson(other.store, CLASS_ID, "2026-10-05");
      expect(theirs.id).toBe(mine.id);
      await other.destroy();
    });

    it("allows past dates", async () => {
      const past = await startLesson(store, CLASS_ID, "2026-09-01");
      expect(past).toMatchObject({ date: "2026-09-01", id: lessonIdFor(CLASS_ID, "2026-09-01") });
    });

    it("revives a deleted lesson for the same date", async () => {
      const lesson = await startLesson(store, CLASS_ID, "2026-10-05");
      await store.softDelete("lessons", lesson.id);
      expect(await findLiveLesson(db, CLASS_ID, "2026-10-05")).toBeUndefined();
      const revived = await startLesson(store, CLASS_ID, "2026-10-05");
      expect(revived).toMatchObject({ id: lesson.id, deletedAt: null });
    });

    it("changes the date unless another lesson already uses it", async () => {
      const monday = await startLesson(store, CLASS_ID, "2026-10-05");
      await startLesson(store, CLASS_ID, "2026-10-06");
      expect(await changeLessonDate(store, monday.id, "2026-10-06")).toEqual({ status: "taken" });
      expect(await changeLessonDate(store, monday.id, "2026-10-04")).toEqual({ status: "changed" });
      expect(await db.get("lessons", monday.id)).toMatchObject({ date: "2026-10-04" });
    });

    it("uses a fresh id when the derived one belongs to a lesson moved to another date", async () => {
      const moved = await startLesson(store, CLASS_ID, "2026-10-05");
      await changeLessonDate(store, moved.id, "2026-10-01");
      const fresh = await startLesson(store, CLASS_ID, "2026-10-05");
      expect(fresh.id).not.toBe(moved.id);
      expect(fresh.date).toBe("2026-10-05");
      expect(await startLesson(store, CLASS_ID, "2026-10-01")).toMatchObject({ id: moved.id });
    });

    it("deletes a lesson with what was recorded in it, keeping other lessons' history", async () => {
      const STUDENT = "01928c5e-7b3a-7cde-8f00-00000000bb01";
      const earlier = await startLesson(store, CLASS_ID, "2026-10-01");
      const lesson = await startLesson(store, CLASS_ID, "2026-10-05");
      const later = await startLesson(store, CLASS_ID, "2026-10-08");
      const portion = { surah: 78, fromAyah: 1, toAyah: 5 };
      const add = (lessonId: string, evaluateNow = false) =>
        addHomework(store, { studentId: STUDENT, lessonId, portion, note: "", evaluateNow });

      const fromEarlier = await add(earlier.id); // recited in the deleted lesson
      await rateHomework(store, fromEarlier, lesson.id, "memorizationRate", 9);
      const recitedNow = await add(lesson.id, true); // "recite now" in the deleted lesson
      const pendingNext = await add(lesson.id); // assigned for the next lesson
      const recitedLater = await add(lesson.id); // assigned here, evaluated later
      await rateHomework(store, recitedLater, later.id, "memorizationRate", 8);
      await setAttendance(store, lesson.id, STUDENT, "present");

      await deleteLesson(store, lesson.id);

      expect((await db.get("lessons", lesson.id))?.deletedAt).not.toBeNull();
      expect(
        (await db.query("attendance", "lessonId", { equals: lesson.id }))[0]?.deletedAt,
      ).not.toBeNull();
      expect(await db.get("homework", fromEarlier.id)).toMatchObject({
        evaluatedLessonId: null,
        memorizationRate: null,
        deletedAt: null,
      });
      expect((await db.get("homework", recitedNow.id))?.deletedAt).not.toBeNull();
      expect((await db.get("homework", pendingNext.id))?.deletedAt).not.toBeNull();
      expect(await db.get("homework", recitedLater.id)).toMatchObject({
        assignedLessonId: null,
        evaluatedLessonId: later.id,
        memorizationRate: 8,
        deletedAt: null,
      });
    });
  });
}
