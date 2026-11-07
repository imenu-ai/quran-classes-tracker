import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { lessonIdFor } from "../../shared/ids";
import { LocalStore } from "../local-store";
import { rateHomework, addHomework } from "../entities/homework";
import { NOT_MEMORIZED } from "../../shared/schemas/homework";
import { deleteLesson } from "../entities/lessons";
import { loadStudentDay, todayLessonId } from "../entities/today";
import type { LocalDatabase } from "../database";
import { openTestDevice, type StorageFactory, type TestDevice } from "./harness";

export function todaySuite(factory: StorageFactory) {
  const CLASS = "01928c5e-7b3a-7cde-8f00-00000000cc01";
  const STUDENT = "01928c5e-7b3a-7cde-8f00-00000000bb01";
  const TODAY = "2026-10-10";

  describe("today's lesson", () => {
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

    it("is created on the first write and reused after, with the class's derived id", async () => {
      expect(await db.count("lessons")).toBe(0);
      const first = await todayLessonId(store, CLASS, TODAY);
      const second = await todayLessonId(store, CLASS, TODAY);
      expect(first).toBe(lessonIdFor(CLASS, TODAY));
      expect(second).toBe(first);
      expect(await db.count("lessons")).toBe(1);
    });

    it("revives a deleted lesson of the same day instead of making another", async () => {
      const id = await todayLessonId(store, CLASS, TODAY);
      await deleteLesson(store, id);
      expect(await todayLessonId(store, CLASS, TODAY)).toBe(id);
      expect((await db.get("lessons", id))?.deletedAt).toBeNull();
    });

    it("shows a past day as it was due then, and creates its lesson on the first write", async () => {
      const portions = [{ surah: 78, fromAyah: 1, toAyah: 10 }];
      const add = async (date: string) =>
        addHomework(store, {
          studentId: STUDENT,
          lessonId: await todayLessonId(store, CLASS, date),
          portions,
          note: "",
          evaluateNow: false,
        });
      const before = await add("2026-10-01");
      const after = await add("2026-10-09");

      const day = await loadStudentDay(db, { id: STUDENT, classId: CLASS }, "2026-10-05");
      expect(day.lesson).toBeNull();
      expect(day.lessonId).toBe(lessonIdFor(CLASS, "2026-10-05"));
      expect(day.homework.toRecite.map((h) => h.id)).toEqual([before.id]);
      // Homework given after that day doesn't count for its suggestion.
      expect(day.history.map((h) => h.id)).toEqual([before.id]);
      expect(day.history.map((h) => h.id)).not.toContain(after.id);
      expect(await db.count("lessons")).toBe(2);

      await rateHomework(
        store,
        before,
        await todayLessonId(store, CLASS, "2026-10-05"),
        "memorizationRate",
        8,
      );
      const marked = await loadStudentDay(db, { id: STUDENT, classId: CLASS }, "2026-10-05");
      expect(marked.lesson?.date).toBe("2026-10-05");
      expect(marked.homework.evaluatedHere.map((h) => h.id)).toEqual([before.id]);
      expect(await db.count("lessons")).toBe(3);
    });

    it("records a day's marks and not-memorized items against that one lesson", async () => {
      const lessonId = await todayLessonId(store, CLASS, TODAY);
      const old = await todayLessonId(store, CLASS, "2026-10-09");
      const portion = { surah: 112, fromAyah: 1, toAyah: 4 };
      const a = await addHomework(store, {
        studentId: STUDENT,
        lessonId: old,
        portions: [portion],
        note: "",
        evaluateNow: false,
      });
      const b = await addHomework(store, {
        studentId: STUDENT,
        lessonId: old,
        portions: [portion],
        note: "",
        evaluateNow: false,
      });

      await rateHomework(store, a, await todayLessonId(store, CLASS, TODAY), "memorizationRate", 9);
      await rateHomework(
        store,
        b,
        await todayLessonId(store, CLASS, TODAY),
        "memorizationRate",
        NOT_MEMORIZED,
      );

      expect(await db.get("homework", a.id)).toMatchObject({ evaluatedLessonId: lessonId });
      expect(await db.get("homework", b.id)).toMatchObject({
        evaluatedLessonId: null,
        notMemorized: [{ lessonId, behaviorRate: null }],
      });
      expect(await db.count("lessons")).toBe(2);
    });
  });
}
