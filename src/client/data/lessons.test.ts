import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { lessonIdFor } from "@/shared/ids";
import { openLocalDb, type LocalDb } from "../db/dexie";
import { LocalStore } from "../db/local-store";
import { changeLessonDate, findLiveLesson, startLesson } from "./lessons";

const CLASS_ID = "01928c5e-7b3a-7cde-8f00-0000000000c1";

describe("lessons", () => {
  let db: LocalDb;
  let store: LocalStore;

  beforeEach(() => {
    db = openLocalDb(`lessons-${crypto.randomUUID()}`);
    store = new LocalStore(db, { tenantId: "t1", deviceId: "d1" });
  });

  afterEach(async () => {
    await db.delete();
  });

  it("creates today's lesson with the derived id, and opens it again instead of duplicating", async () => {
    const first = await startLesson(store, CLASS_ID, "2026-10-05");
    expect(first.id).toBe(lessonIdFor(CLASS_ID, "2026-10-05"));
    const again = await startLesson(store, CLASS_ID, "2026-10-05");
    expect(again.id).toBe(first.id);
    expect(await db.lessons.count()).toBe(1);
  });

  it("two devices starting the same lesson offline produce the same id", async () => {
    const otherDb = openLocalDb(`lessons-other-${crypto.randomUUID()}`);
    const otherStore = new LocalStore(otherDb, { tenantId: "t1", deviceId: "d2" });
    const mine = await startLesson(store, CLASS_ID, "2026-10-05");
    const theirs = await startLesson(otherStore, CLASS_ID, "2026-10-05");
    expect(theirs.id).toBe(mine.id);
    await otherDb.delete();
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
    expect(await db.lessons.get(monday.id)).toMatchObject({ date: "2026-10-04" });
  });

  it("uses a fresh id when the derived one belongs to a lesson moved to another date", async () => {
    const moved = await startLesson(store, CLASS_ID, "2026-10-05");
    await changeLessonDate(store, moved.id, "2026-10-01");
    const fresh = await startLesson(store, CLASS_ID, "2026-10-05");
    expect(fresh.id).not.toBe(moved.id);
    expect(fresh.date).toBe("2026-10-05");
    expect(await startLesson(store, CLASS_ID, "2026-10-01")).toMatchObject({ id: moved.id });
  });
});
