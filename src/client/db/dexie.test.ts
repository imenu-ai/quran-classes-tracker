import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { SYNC_TABLES } from "@/shared/sync/tables";
import { localDbName, openLocalDb, type LocalDb } from "./dexie";

const base = {
  tenantId: "t1",
  createdAt: 1,
  updatedAt: 1,
  updatedBy: "dev",
  deletedAt: null,
  serverVersion: 0,
};

describe("LocalDb", () => {
  let db: LocalDb;

  afterEach(async () => {
    await db.delete();
  });

  it("names the database per user", () => {
    expect(localDbName("u1")).toBe("qct-u1");
    db = openLocalDb("u1");
    expect(db.name).toBe("qct-u1");
  });

  it("opens with every syncable table plus outbox, rejected and meta", async () => {
    db = openLocalDb("u2");
    await db.open();
    const names = db.tables.map((table) => table.name).sort();
    expect(names).toEqual([...SYNC_TABLES, "meta", "outbox", "rejected"].sort());
  });

  it("writes and reads every table, and queries the indexes", async () => {
    db = openLocalDb("u3");
    await db.classes.add({ ...base, id: "c1", name: "حلقة", archivedAt: null });
    await db.students.add({
      ...base,
      id: "s1",
      classId: "c1",
      fullName: "أحمد",
      birthYear: 2014,
      note: "",
      memorizationDirection: "forward",
      archivedAt: null,
    });
    await db.lessons.add({ ...base, id: "l1", classId: "c1", date: "2026-10-05", note: "" });
    await db.attendance.add({
      ...base,
      id: "a1",
      lessonId: "l1",
      studentId: "s1",
      status: "present",
      excuseNote: "",
    });
    await db.homework.add({
      ...base,
      id: "h1",
      studentId: "s1",
      surah: 78,
      fromAyah: 1,
      toAyah: 10,
      note: "",
      assignedLessonId: "l1",
      evaluatedLessonId: null,
      memorizationRate: null,
      behaviorRate: null,
    });
    await db.outbox.add({
      recordId: "c1",
      table: "classes",
      rev: 1,
      enqueuedAt: 1,
      attempts: 0,
      lastError: null,
    });
    await db.rejected.add({
      recordId: "h9",
      table: "homework",
      code: "AYAH_OUT_OF_RANGE",
      params: { surah: 1, ayahCount: 7 },
      rejectedAt: 2,
    });
    await db.meta.put({ key: "cursor", value: 42 });

    expect(await db.students.where("classId").equals("c1").count()).toBe(1);
    expect(
      await db.lessons.where("[classId+date]").equals(["c1", "2026-10-05"]).first(),
    ).toMatchObject({ id: "l1" });
    expect(await db.attendance.where("lessonId").equals("l1").count()).toBe(1);
    expect(await db.homework.where("studentId").equals("s1").count()).toBe(1);
    expect(await db.syncTable("homework").get("h1")).toMatchObject({ surah: 78 });
    expect(await db.outbox.orderBy("enqueuedAt").first()).toMatchObject({ recordId: "c1" });
    expect(await db.rejected.get("h9")).toMatchObject({ code: "AYAH_OUT_OF_RANGE" });
    expect(await db.meta.get("cursor")).toEqual({ key: "cursor", value: 42 });
  });

  it("keeps two users' data apart", async () => {
    db = openLocalDb("alice");
    const other = openLocalDb("bob");
    await db.classes.add({ ...base, id: "c1", name: "A", archivedAt: null });
    expect(await other.classes.count()).toBe(0);
    await other.delete();
  });
});
