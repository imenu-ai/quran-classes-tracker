import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { classRecord, homeworkRecord, lessonRecord, studentRecord } from "../../test/records";
import { LocalDatabase } from "../database";
import type { StorageAdapter } from "../storage";
import type { StorageFactory } from "./harness";

/**
 * The storage contract (storage.ts) that every adapter must meet. Records
 * are plain builders; ids are chosen so their order is easy to read.
 */
export function storageContractSuite(factory: StorageFactory) {
  describe("storage contract", () => {
    let adapter: StorageAdapter;
    let db: LocalDatabase;

    beforeEach(async () => {
      adapter = await factory();
      db = new LocalDatabase(adapter);
    });

    afterEach(async () => {
      await adapter.destroy();
    });

    it("starts empty", async () => {
      expect(await db.get("classes", "c1")).toBeUndefined();
      expect(await db.all("students")).toEqual([]);
      expect(await db.count("outbox")).toBe(0);
    });

    it("writes, overwrites and deletes records, and returns copies", async () => {
      await db.transaction(async (tx) => {
        await tx.put("classes", classRecord({ id: "c1", name: "أ" }));
        await tx.put("classes", classRecord({ id: "c1", name: "ب" }));
        await tx.bulkPut("classes", [classRecord({ id: "c2" }), classRecord({ id: "c3" })]);
        await tx.put("meta", { key: "cursor", value: 7 });
        await tx.put("outbox", {
          recordId: "c1",
          table: "classes",
          rev: 1,
          enqueuedAt: 5,
          attempts: 0,
          lastError: null,
        });
      });
      const first = await db.get("classes", "c1");
      expect(first).toMatchObject({ id: "c1", name: "ب" });
      first!.name = "changed by the caller";
      expect(await db.get("classes", "c1")).toMatchObject({ name: "ب" });
      expect(await db.get("meta", "cursor")).toEqual({ key: "cursor", value: 7 });
      expect(await db.get("outbox", "c1")).toMatchObject({ rev: 1 });

      await db.transaction(async (tx) => {
        await tx.delete("classes", "c2");
        await tx.bulkDelete("classes", ["c3", "missing"]);
      });
      expect((await db.all("classes")).map((c) => c.id)).toEqual(["c1"]);
      expect(await db.count("classes")).toBe(1);
    });

    it("bulk-gets in the order asked, with undefined for missing keys", async () => {
      await db.transaction((tx) =>
        tx.bulkPut("classes", [classRecord({ id: "c1" }), classRecord({ id: "c2" })]),
      );
      const found = await db.bulkGet("classes", ["c2", "nope", "c1"]);
      expect(found.map((c) => c?.id)).toEqual(["c2", undefined, "c1"]);
    });

    it("lists all records by primary key", async () => {
      await db.transaction((tx) =>
        tx.bulkPut(
          "classes",
          ["c3", "c1", "c2"].map((id) => classRecord({ id })),
        ),
      );
      expect((await db.all("classes")).map((c) => c.id)).toEqual(["c1", "c2", "c3"]);
    });

    describe("queries", () => {
      beforeEach(async () => {
        await db.transaction(async (tx) => {
          await tx.bulkPut("students", [
            studentRecord("k2", { id: "s3", fullName: "ج" }),
            studentRecord("k1", { id: "s2", fullName: "ب" }),
            studentRecord("k1", { id: "s1", fullName: "أ" }),
            studentRecord("k3", { id: "s4", fullName: "د" }),
          ]);
          await tx.bulkPut("lessons", [
            lessonRecord("k1", { id: "l1", date: "2026-10-01" }),
            lessonRecord("k1", { id: "l2", date: "2026-10-15" }),
            lessonRecord("k1", { id: "l3", date: "2026-11-01" }),
            lessonRecord("k2", { id: "l4", date: "2026-10-15" }),
          ]);
          await tx.bulkPut("homework", [
            homeworkRecord("s1", { id: "h1", evaluatedLessonId: "l2" }),
            homeworkRecord("s1", { id: "h2", evaluatedLessonId: null }),
            homeworkRecord("s2", { id: "h3", evaluatedLessonId: "l1" }),
          ]);
        });
      });

      it("equals, ordered by the index value then the primary key", async () => {
        const k1 = await db.query("students", "classId", { equals: "k1" });
        expect(k1.map((s) => s.id)).toEqual(["s1", "s2"]);
        const byDate = await db.query("lessons", "date", { equals: "2026-10-15" });
        expect(byDate.map((l) => l.id)).toEqual(["l2", "l4"]);
      });

      it("equals on a compound index, with a tuple", async () => {
        const found = await db.query("lessons", "[classId+date]", {
          equals: ["k1", "2026-10-15"],
        });
        expect(found.map((l) => l.id)).toEqual(["l2"]);
      });

      it("anyOf, ordered by the index value; an empty list finds nothing", async () => {
        const found = await db.query("students", "classId", { anyOf: ["k3", "k1"] });
        expect(found.map((s) => s.id)).toEqual(["s1", "s2", "s4"]);
        expect(await db.query("students", "classId", { anyOf: [] })).toEqual([]);
      });

      it("between, including both ends, also on a compound index", async () => {
        const october = await db.query("lessons", "date", {
          between: ["2026-10-01", "2026-10-31"],
        });
        expect(october.map((l) => l.id)).toEqual(["l1", "l2", "l4"]);
        const k1October = await db.query("lessons", "[classId+date]", {
          between: [
            ["k1", "2026-10-01"],
            ["k1", "2026-10-15"],
          ],
        });
        expect(k1October.map((l) => l.id)).toEqual(["l1", "l2"]);
      });

      it("leaves out records whose indexed field is null", async () => {
        const evaluated = await db.query("homework", "evaluatedLessonId", {
          anyOf: ["l1", "l2"],
        });
        expect(evaluated.map((h) => h.id)).toEqual(["h3", "h1"]);
        const all = await db.query("homework", "studentId", { equals: "s1" });
        expect(all.map((h) => h.id)).toEqual(["h1", "h2"]);
      });

      it("queries a number index", async () => {
        await db.transaction((tx) =>
          tx.bulkPut(
            "outbox",
            [30, 10, 20].map((enqueuedAt) => ({
              recordId: `r${enqueuedAt}`,
              table: "classes" as const,
              rev: 1,
              enqueuedAt,
              attempts: 0,
              lastError: null,
            })),
          ),
        );
        const found = await db.query("outbox", "enqueuedAt", { between: [10, 20] });
        expect(found.map((e) => e.recordId)).toEqual(["r10", "r20"]);
      });
    });

    describe("transactions", () => {
      it("see their own writes", async () => {
        const seen = await db.transaction(async (tx) => {
          await tx.put("classes", classRecord({ id: "c1" }));
          return [await tx.get("classes", "c1"), await tx.count("classes")];
        });
        expect(seen).toEqual([expect.objectContaining({ id: "c1" }), 1]);
      });

      it("keep nothing when the function throws", async () => {
        await db.transaction((tx) => tx.put("classes", classRecord({ id: "kept" })));
        await expect(
          db.transaction(async (tx) => {
            await tx.put("classes", classRecord({ id: "c1" }));
            await tx.delete("classes", "kept");
            await tx.put("meta", { key: "cursor", value: 9 });
            throw new Error("boom");
          }),
        ).rejects.toThrow("boom");
        expect((await db.all("classes")).map((c) => c.id)).toEqual(["kept"]);
        expect(await db.get("meta", "cursor")).toBeUndefined();
      });

      it("run one at a time (read-modify-write never loses an update)", async () => {
        const increment = () =>
          db.transaction(async (tx) => {
            const value = ((await tx.get("meta", "n"))?.value as number | undefined) ?? 0;
            await tx.put("meta", { key: "n", value: value + 1 });
          });
        await Promise.all([increment(), increment(), increment()]);
        expect((await db.get("meta", "n"))?.value).toBe(3);
      });

      it("announce the tables they changed after commit, and nothing when they fail", async () => {
        const listener = vi.fn();
        db.subscribe(listener);
        await db.transaction(async (tx) => {
          await tx.put("classes", classRecord({ id: "c1" }));
          await tx.put("meta", { key: "cursor", value: 1 });
          // A listener hears nothing before the commit.
          expect(listener).not.toHaveBeenCalled();
        });
        expect(listener).toHaveBeenCalledTimes(1);
        expect([...listener.mock.calls[0]![0]].sort()).toEqual(["classes", "meta"]);

        await db.transaction((tx) => tx.get("classes", "c1"));
        await db
          .transaction(async (tx) => {
            await tx.put("students", studentRecord("c1", { id: "s1" }));
            throw new Error("boom");
          })
          .catch(() => {});
        expect(listener).toHaveBeenCalledTimes(1);
      });
    });

    // An adapter isn't used after destroy (Dexie refuses to reopen it); each
    // adapter's own tests check that the database is gone for good.
    it("destroys the database", async () => {
      await db.transaction((tx) => tx.put("classes", classRecord({ id: "c1" })));
      await expect(db.destroy()).resolves.toBeUndefined();
    });
  });
}
