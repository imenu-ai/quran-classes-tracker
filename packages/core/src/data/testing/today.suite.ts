import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { lessonIdFor } from "../../shared/ids";
import { LocalStore } from "../local-store";
import { postponeHomework, rateHomework, addHomework } from "../entities/homework";
import { deleteLesson } from "../entities/lessons";
import { todayLessonId } from "../entities/today";
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

    it("records a day's marks and postponements against that one lesson", async () => {
      const lessonId = await todayLessonId(store, CLASS, TODAY);
      const old = await todayLessonId(store, CLASS, "2026-10-09");
      const portion = { surah: 112, fromAyah: 1, toAyah: 4 };
      const a = await addHomework(store, {
        studentId: STUDENT,
        lessonId: old,
        portion,
        note: "",
        evaluateNow: false,
      });
      const b = await addHomework(store, {
        studentId: STUDENT,
        lessonId: old,
        portion,
        note: "",
        evaluateNow: false,
      });

      await rateHomework(store, a, await todayLessonId(store, CLASS, TODAY), "memorizationRate", 9);
      await postponeHomework(store, b, await todayLessonId(store, CLASS, TODAY));

      expect(await db.get("homework", a.id)).toMatchObject({ evaluatedLessonId: lessonId });
      expect(await db.get("homework", b.id)).toMatchObject({
        evaluatedLessonId: null,
        postponedLessonIds: [lessonId],
      });
      expect(await db.count("lessons")).toBe(2);
    });
  });
}
