import type { Db } from "mongodb";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MAX_CLOCK_SKEW_MS } from "@/shared/sync/lww";
import type { PushMutation } from "@/shared/sync/protocol";
import type { SyncTable } from "@/shared/sync/tables";
import { startTestMongo } from "@/test/mongo";
import { classRecord, homeworkRecord, lessonRecord, studentRecord } from "@/test/records";
import { ensureIndexes } from "../indexes";
import { pushChanges } from "./push";

const NOW = 1_000_000;

const m = (table: SyncTable, record: object): PushMutation => ({
  table,
  record: record as Record<string, unknown>,
});

describe("pushChanges", () => {
  let db: Db;
  let stop: () => Promise<void>;
  const stored = (table: string, id: string) => db.collection(table).findOne({ _id: id as never });

  beforeAll(async () => {
    ({ db, stop } = await startTestMongo());
    await ensureIndexes(db);
  });

  afterAll(async () => {
    await stop();
  });

  it("applies a new record, forces the session tenant and assigns a version", async () => {
    const record = classRecord();
    const [result] = await pushChanges(db, "tenant-a", [m("classes", record)], NOW);

    expect(result).toMatchObject({ id: record.id, table: "classes", status: "applied" });
    expect(result?.serverVersion).toBeGreaterThan(0);
    const doc = await stored("classes", record.id);
    expect(doc).toMatchObject({
      tenantId: "tenant-a", // not "client-supplied-tenant"
      name: "حلقة الفجر",
      serverVersion: result?.serverVersion,
    });
    expect(doc).not.toHaveProperty("id");
  });

  it("assigns increasing versions in batch order", async () => {
    const records = [classRecord(), classRecord(), classRecord()];
    const results = await pushChanges(
      db,
      "tenant-a",
      records.map((r) => m("classes", r)),
      NOW,
    );
    const versions = results.map((r) => r.serverVersion ?? 0);
    expect(versions[1]).toBe(versions[0]! + 1);
    expect(versions[2]).toBe(versions[1]! + 1);
  });

  describe("last write wins", () => {
    it("a newer write replaces the stored copy", async () => {
      const original = classRecord({ updatedAt: 1_000 });
      await pushChanges(db, "tenant-a", [m("classes", original)], NOW);
      const newer = { ...original, name: "newer", updatedAt: 2_000 };
      const [result] = await pushChanges(db, "tenant-a", [m("classes", newer)], NOW);
      expect(result?.status).toBe("applied");
      expect(await stored("classes", original.id)).toMatchObject({ name: "newer" });
    });

    it("an older write is stale and changes nothing", async () => {
      const current = classRecord({ updatedAt: 5_000, name: "current" });
      await pushChanges(db, "tenant-a", [m("classes", current)], NOW);
      const older = { ...current, name: "older", updatedAt: 4_000 };
      const [result] = await pushChanges(db, "tenant-a", [m("classes", older)], NOW);
      expect(result?.status).toBe("stale");
      expect(await stored("classes", current.id)).toMatchObject({ name: "current" });
    });

    it("an exact tie goes to the higher device id", async () => {
      const fromA = classRecord({ updatedAt: 7_000, updatedBy: "device-a", name: "A" });
      await pushChanges(db, "tenant-a", [m("classes", fromA)], NOW);

      const fromB = { ...fromA, updatedBy: "device-b", name: "B" };
      expect((await pushChanges(db, "tenant-a", [m("classes", fromB)], NOW))[0]?.status).toBe(
        "applied",
      );
      const fromAAgain = { ...fromA, name: "A again" };
      expect((await pushChanges(db, "tenant-a", [m("classes", fromAAgain)], NOW))[0]?.status).toBe(
        "stale",
      );
      expect(await stored("classes", fromA.id)).toMatchObject({ name: "B" });
    });

    it("a retried push (same time, same device) is stale, not an error", async () => {
      const record = classRecord({ updatedAt: 8_000 });
      await pushChanges(db, "tenant-a", [m("classes", record)], NOW);
      const [retry] = await pushChanges(db, "tenant-a", [m("classes", record)], NOW);
      expect(retry?.status).toBe("stale");
    });
  });

  describe("soft deletes", () => {
    it("applies a delete, then a later edit wins and an earlier one loses", async () => {
      const record = classRecord({ updatedAt: 1_000 });
      await pushChanges(db, "tenant-a", [m("classes", record)], NOW);

      const deleted = { ...record, deletedAt: 2_000, updatedAt: 2_000 };
      expect((await pushChanges(db, "tenant-a", [m("classes", deleted)], NOW))[0]?.status).toBe(
        "applied",
      );
      expect(await stored("classes", record.id)).toMatchObject({ deletedAt: 2_000 });

      const editBeforeDelete = { ...record, name: "edited offline earlier", updatedAt: 1_500 };
      expect(
        (await pushChanges(db, "tenant-a", [m("classes", editBeforeDelete)], NOW))[0]?.status,
      ).toBe("stale");
      expect(await stored("classes", record.id)).toMatchObject({ deletedAt: 2_000 });

      const editAfterDelete = { ...record, name: "restored", deletedAt: null, updatedAt: 3_000 };
      expect(
        (await pushChanges(db, "tenant-a", [m("classes", editAfterDelete)], NOW))[0]?.status,
      ).toBe("applied");
      expect(await stored("classes", record.id)).toMatchObject({
        name: "restored",
        deletedAt: null,
      });
    });
  });

  describe("tenant isolation", () => {
    it("refuses an id that belongs to another tenant and leaves it untouched", async () => {
      const theirs = classRecord({ name: "tenant B's class", updatedAt: 1_000 });
      await pushChanges(db, "tenant-b", [m("classes", theirs)], NOW);

      const hijack = { ...theirs, name: "hijacked", updatedAt: 9_999 };
      const [result] = await pushChanges(db, "tenant-a", [m("classes", hijack)], NOW);

      expect(result).toMatchObject({ status: "rejected", code: "FORBIDDEN" });
      expect(await stored("classes", theirs.id)).toMatchObject({
        tenantId: "tenant-b",
        name: "tenant B's class",
      });
    });

    it("refuses a reference to another tenant's student", async () => {
      const theirClass = classRecord();
      const theirStudent = studentRecord(theirClass.id);
      await pushChanges(
        db,
        "tenant-b",
        [m("classes", theirClass), m("students", theirStudent)],
        NOW,
      );

      const [result] = await pushChanges(
        db,
        "tenant-a",
        [m("homework", homeworkRecord(theirStudent.id))],
        NOW,
      );
      expect(result).toMatchObject({
        status: "rejected",
        code: "REFERENCE_NOT_FOUND",
        params: { field: "studentId" },
      });
    });
  });

  describe("references", () => {
    it("accepts children whose parents come earlier in the same batch", async () => {
      const cls = classRecord();
      const student = studentRecord(cls.id);
      const lesson = lessonRecord(cls.id);
      const homework = homeworkRecord(student.id, { assignedLessonId: lesson.id });
      const results = await pushChanges(
        db,
        "tenant-a",
        [m("classes", cls), m("students", student), m("lessons", lesson), m("homework", homework)],
        NOW,
      );
      expect(results.map((r) => r.status)).toEqual(["applied", "applied", "applied", "applied"]);
    });

    it("refuses a child whose parent is missing (and its own children after it)", async () => {
      const student = studentRecord("01928c5e-7b3a-7cde-8f00-0000000000aa");
      const homework = homeworkRecord(student.id);
      const results = await pushChanges(
        db,
        "tenant-a",
        [m("students", student), m("homework", homework)],
        NOW,
      );
      expect(results.map((r) => [r.status, r.code])).toEqual([
        ["rejected", "REFERENCE_NOT_FOUND"],
        ["rejected", "REFERENCE_NOT_FOUND"],
      ]);
    });

    it("still links to a soft-deleted parent", async () => {
      const cls = classRecord({ deletedAt: 500 });
      await pushChanges(db, "tenant-a", [m("classes", cls)], NOW);
      const [result] = await pushChanges(
        db,
        "tenant-a",
        [m("students", studentRecord(cls.id))],
        NOW,
      );
      expect(result?.status).toBe("applied");
    });
  });

  describe("validation", () => {
    it("rejects an invalid ayah range with the sura map's code", async () => {
      const cls = classRecord();
      const student = studentRecord(cls.id);
      await pushChanges(db, "tenant-a", [m("classes", cls), m("students", student)], NOW);

      const bad = homeworkRecord(student.id, { surah: 2, fromAyah: 280, toAyah: 290 });
      const [result] = await pushChanges(db, "tenant-a", [m("homework", bad)], NOW);
      expect(result).toMatchObject({
        id: bad.id,
        status: "rejected",
        code: "AYAH_OUT_OF_RANGE",
        params: { surah: 2, ayahCount: 286, field: "toAyah" },
      });
      expect(await stored("homework", bad.id)).toBeNull();
    });

    it("rejects malformed records without blocking valid ones in the batch", async () => {
      const good = classRecord();
      const results = await pushChanges(
        db,
        "tenant-a",
        [m("classes", { ...classRecord(), name: "" }), m("classes", good), m("classes", { id: 7 })],
        NOW,
      );
      expect(results.map((r) => r.status)).toEqual(["rejected", "applied", "rejected"]);
      expect(results[0]).toMatchObject({ code: "REQUIRED", params: { field: "name" } });
      expect(results[2]?.id).toBe("");
    });
  });

  it("clamps a device clock set far into the future", async () => {
    const record = classRecord({ updatedAt: NOW + 10 * MAX_CLOCK_SKEW_MS });
    await pushChanges(db, "tenant-a", [m("classes", record)], NOW);
    expect(await stored("classes", record.id)).toMatchObject({
      updatedAt: NOW + MAX_CLOCK_SKEW_MS,
    });
  });

  it("releases its version reservation even when nothing was written", async () => {
    const counter = await db.collection("counters").findOne({ _id: "tenant-a" as never });
    expect(counter?.inFlight).toEqual([]);
  });
});
