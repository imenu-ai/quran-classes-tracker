import type { Db } from "mongodb";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PullResponse } from "@/shared/sync/protocol";
import { startTestMongo } from "@/test/mongo";
import { classRecord, lessonRecord, studentRecord } from "@/test/records";
import { ensureIndexes } from "../indexes";
import { pullChanges } from "./pull";
import { pushChanges } from "./push";
import { allocateVersions } from "./versions";

const NOW = 1_000_000;

const ids = (response: PullResponse) =>
  Object.values(response.changes)
    .flat()
    .map((record) => record.id);

describe("pullChanges", () => {
  let db: Db;
  let stop: () => Promise<void>;

  beforeAll(async () => {
    ({ db, stop } = await startTestMongo());
    await ensureIndexes(db);
  });

  afterAll(async () => {
    await stop();
  });

  it("returns nothing for a tenant without data", async () => {
    expect(await pullChanges(db, "empty", 0, 100)).toEqual({
      changes: { classes: [], students: [], lessons: [], attendance: [], homework: [] },
      cursor: 0,
      hasMore: false,
    });
  });

  it("returns every table's records as client records (id, not _id)", async () => {
    const cls = classRecord();
    const student = studentRecord(cls.id);
    const lesson = lessonRecord(cls.id);
    await pushChanges(
      db,
      "t-all",
      [
        { table: "classes", record: cls },
        { table: "students", record: student },
        { table: "lessons", record: lesson },
      ],
      NOW,
    );

    const response = await pullChanges(db, "t-all", 0, 100);
    expect(response.hasMore).toBe(false);
    expect(response.cursor).toBe(3);
    expect(response.changes.classes[0]).toMatchObject({
      id: cls.id,
      tenantId: "t-all",
      name: cls.name,
      serverVersion: 1,
    });
    expect(response.changes.classes[0]).not.toHaveProperty("_id");
    expect(response.changes.students.map((s) => s.id)).toEqual([student.id]);
    expect(response.changes.lessons.map((l) => l.id)).toEqual([lesson.id]);
  });

  it("paginates in version order across tables with an exact cursor", async () => {
    const cls = classRecord();
    const records = [
      { table: "classes" as const, record: cls },
      { table: "students" as const, record: studentRecord(cls.id) },
      { table: "lessons" as const, record: lessonRecord(cls.id) },
      { table: "students" as const, record: studentRecord(cls.id) },
      { table: "lessons" as const, record: lessonRecord(cls.id, { date: "2026-10-06" }) },
    ];
    await pushChanges(db, "t-page", records, NOW);
    const expectedOrder = records.map((r) => r.record.id);

    const seen: string[] = [];
    let cursor = 0;
    const pages: boolean[] = [];
    for (;;) {
      const page = await pullChanges(db, "t-page", cursor, 2);
      const pageIds = ids(page);
      // Within a page, records are grouped by table; order the page by version to compare.
      const ordered = Object.values(page.changes)
        .flat()
        .sort((a, b) => a.serverVersion - b.serverVersion)
        .map((r) => r.id);
      expect(pageIds.length).toBeLessThanOrEqual(2);
      seen.push(...ordered);
      cursor = page.cursor;
      pages.push(page.hasMore);
      if (!page.hasMore) break;
    }
    expect(seen).toEqual(expectedOrder);
    expect(pages).toEqual([true, true, false]);
    expect(cursor).toBe(5);
  });

  it("includes soft-deleted records", async () => {
    const cls = classRecord();
    await pushChanges(db, "t-del", [{ table: "classes", record: cls }], NOW);
    const after = (await pullChanges(db, "t-del", 0, 100)).cursor;
    await pushChanges(
      db,
      "t-del",
      [{ table: "classes", record: { ...cls, deletedAt: 2_000, updatedAt: 2_000 } }],
      NOW,
    );

    const response = await pullChanges(db, "t-del", after, 100);
    expect(response.changes.classes).toEqual([
      expect.objectContaining({ id: cls.id, deletedAt: 2_000 }),
    ]);
  });

  it("only returns the tenant's own records", async () => {
    await pushChanges(db, "t-x", [{ table: "classes", record: classRecord() }], NOW);
    await pushChanges(db, "t-y", [{ table: "classes", record: classRecord() }], NOW);
    const response = await pullChanges(db, "t-x", 0, 100);
    expect(response.changes.classes).toHaveLength(1);
    expect(response.changes.classes[0]?.tenantId).toBe("t-x");
  });

  it("never hands out versions above an unreleased reservation", async () => {
    await pushChanges(db, "t-wm", [{ table: "classes", record: classRecord() }], NOW); // v1
    const pending = await allocateVersions(db, "t-wm", 1); // v2 reserved, not written yet
    await pushChanges(db, "t-wm", [{ table: "classes", record: classRecord() }], NOW); // v3

    const blocked = await pullChanges(db, "t-wm", 0, 100);
    expect(blocked.changes.classes.map((c) => c.serverVersion)).toEqual([1]);
    expect(blocked.cursor).toBe(1);

    await pending.release();
    const after = await pullChanges(db, "t-wm", blocked.cursor, 100);
    expect(after.changes.classes.map((c) => c.serverVersion)).toEqual([3]);
    expect(after.cursor).toBe(3);
  });

  it("returns an empty page at the cursor when nothing changed", async () => {
    const first = await pullChanges(db, "t-all", 0, 100);
    const again = await pullChanges(db, "t-all", first.cursor, 100);
    expect(ids(again)).toEqual([]);
    expect(again.cursor).toBe(first.cursor);
  });
});
