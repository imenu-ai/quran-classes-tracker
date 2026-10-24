import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LocalRecordNotFoundError, LocalValidationError, type LocalStore } from "../local-store";
import type { LocalDatabase } from "../database";
import { acknowledge, markFailed, readOutboxBatch, reject, retryRejected } from "../outbox";
import { failingWrites, openTestDevice, type StorageFactory, type TestDevice } from "./harness";

const CLASS_ID = "01928c5e-7b3a-7cde-8f00-0123456789ab";

export function localStoreSuite(factory: StorageFactory) {
  describe("LocalStore + outbox", () => {
    let device: TestDevice;
    let db: LocalDatabase;
    let store: LocalStore;
    let failOutbox = false;

    beforeEach(async () => {
      failOutbox = false;
      device = await openTestDevice(factory, {
        wrap: (adapter) => failingWrites(adapter, "outbox", () => failOutbox),
      });
      ({ db, store } = device);
    });

    afterEach(async () => {
      await device.destroy();
    });

    it("creates a full record and queues it", async () => {
      const created = await store.create("classes", { name: "  حلقة الفجر ", archivedAt: null });

      expect(created).toMatchObject({
        name: "حلقة الفجر",
        tenantId: "t1",
        createdAt: 1_000,
        updatedAt: 1_000,
        updatedBy: "device-a",
        deletedAt: null,
        serverVersion: 0,
      });
      expect(created.id).toMatch(/^[0-9a-f-]{36}$/);
      expect(await db.get("classes", created.id)).toEqual(created);
      expect(await db.get("outbox", created.id)).toEqual({
        recordId: created.id,
        table: "classes",
        rev: 1,
        enqueuedAt: 1_000,
        attempts: 0,
        lastError: null,
      });
    });

    it("accepts a caller-chosen id (deterministic lesson/attendance ids)", async () => {
      const created = await store.create(
        "classes",
        { name: "A", archivedAt: null },
        { id: CLASS_ID },
      );
      expect(created.id).toBe(CLASS_ID);
      await expect(
        store.create("classes", { name: "B", archivedAt: null }, { id: CLASS_ID }),
      ).rejects.toThrow(/already exists/);
    });

    it("coalesces edits into one outbox entry and bumps rev, keeping the first enqueue time", async () => {
      const created = await store.create("classes", { name: "A", archivedAt: null });
      device.setNow(2_000);
      await store.update("classes", created.id, { name: "B" });
      await store.update("classes", created.id, { name: "C" });

      expect(await db.count("outbox")).toBe(1);
      expect(await db.get("outbox", created.id)).toMatchObject({ rev: 3, enqueuedAt: 1_000 });
      expect(await db.get("classes", created.id)).toMatchObject({ name: "C" });
    });

    it("issues strictly increasing timestamps even when the clock stands still or goes back", async () => {
      const created = await store.create("classes", { name: "A", archivedAt: null });
      const first = await store.update("classes", created.id, { name: "B" });
      device.setNow(500);
      const second = await store.update("classes", created.id, { name: "C" });
      expect(first.updatedAt).toBe(1_001);
      expect(second.updatedAt).toBe(1_002);
    });

    it("rejects invalid data with codes and writes nothing", async () => {
      const error = await store
        .create("classes", { name: "   ", archivedAt: null })
        .catch((e: unknown) => e);
      expect(error).toBeInstanceOf(LocalValidationError);
      expect((error as LocalValidationError).errors[0]).toMatchObject({
        path: "name",
        code: "REQUIRED",
      });
      expect(await db.count("classes")).toBe(0);
      expect(await db.count("outbox")).toBe(0);
      // Not even the clock moved.
      expect(await db.get("meta", "clock")).toBeUndefined();
    });

    it("validates homework ayah ranges locally too", async () => {
      const error = await store
        .create("homework", {
          studentId: CLASS_ID,
          surah: 108,
          fromAyah: 1,
          toAyah: 4,
          note: "",
          assignedLessonId: null,
          evaluatedLessonId: null,
          memorizationRate: null,
          behaviorRate: null,
          postponedLessonIds: [],
          kind: "homework",
        })
        .catch((e: unknown) => e);
      expect((error as LocalValidationError).errors[0]).toMatchObject({
        path: "toAyah",
        code: "AYAH_OUT_OF_RANGE",
      });
    });

    it("is atomic: if the outbox write fails, the record isn't saved either", async () => {
      failOutbox = true;
      await expect(store.create("classes", { name: "A", archivedAt: null })).rejects.toThrow(
        "disk full",
      );
      failOutbox = false;
      expect(await db.count("classes")).toBe(0);
    });

    it("runs a multi-record transaction all or nothing", async () => {
      await expect(
        store.transaction(async (tx) => {
          await tx.create("classes", { name: "A", archivedAt: null });
          await tx.create("classes", { name: "B", archivedAt: null });
          throw new Error("changed my mind");
        }),
      ).rejects.toThrow("changed my mind");
      expect(await db.count("classes")).toBe(0);
      expect(await db.count("outbox")).toBe(0);

      const both = await store.transaction(async (tx) => [
        await tx.create("classes", { name: "A", archivedAt: null }),
        // A transaction started inside joins it.
        await tx.transaction((inner) => inner.create("classes", { name: "B", archivedAt: null })),
      ]);
      expect(both.map((c) => c.name)).toEqual(["A", "B"]);
      expect(await db.count("outbox")).toBe(2);
    });

    it("soft-deletes and restores, queueing both", async () => {
      const created = await store.create("classes", { name: "A", archivedAt: null });
      device.setNow(3_000);
      const deleted = await store.softDelete("classes", created.id);
      expect(deleted.deletedAt).toBe(3_000);
      expect(await db.get("outbox", created.id)).toMatchObject({ rev: 2 });

      const restored = await store.restore("classes", created.id);
      expect(restored.deletedAt).toBeNull();
      expect(await db.get("outbox", created.id)).toMatchObject({ rev: 3 });
    });

    it("upserts: creates with the given id, then updates and revives it", async () => {
      const created = await store.upsert("classes", CLASS_ID, { name: "A", archivedAt: null });
      expect(created).toMatchObject({ id: CLASS_ID, name: "A", createdAt: 1_000 });
      await store.softDelete("classes", CLASS_ID);
      device.setNow(5_000);
      const revived = await store.upsert("classes", CLASS_ID, { name: "B", archivedAt: null });
      expect(revived).toMatchObject({
        name: "B",
        deletedAt: null,
        createdAt: 1_000,
        updatedAt: 5_000,
      });
      expect(await db.get("outbox", CLASS_ID)).toMatchObject({ rev: 3 });
    });

    it("throws for an unknown record", async () => {
      await expect(store.update("classes", CLASS_ID, { name: "x" })).rejects.toBeInstanceOf(
        LocalRecordNotFoundError,
      );
    });

    it("notifies subscribers after each committed write, with the tables it changed", async () => {
      const listener = vi.fn();
      const unsubscribe = store.subscribe(listener);
      await store.create("classes", { name: "A", archivedAt: null });
      await store.create("classes", { name: "", archivedAt: null }).catch(() => {});
      expect(listener).toHaveBeenCalledTimes(1);
      expect([...listener.mock.calls[0]![0]].sort()).toEqual(
        ["classes", "meta", "outbox", "rejected"].sort(),
      );
      unsubscribe();
    });

    describe("push bookkeeping", () => {
      it("reads the batch oldest first with the latest snapshot", async () => {
        const first = await store.create("classes", { name: "A", archivedAt: null });
        device.setNow(2_000);
        await store.create("classes", { name: "B", archivedAt: null });
        await store.update("classes", first.id, { name: "A2" });

        const batch = await readOutboxBatch(db, 10);
        expect(batch.map((item) => (item.record as { name: string }).name)).toEqual(["A2", "B"]);
      });

      it("acknowledging clears the entry only if it wasn't edited during the push", async () => {
        const a = await store.create("classes", { name: "A", archivedAt: null });
        const b = await store.create("classes", { name: "B", archivedAt: null });
        const sent = (await readOutboxBatch(db, 10)).map((item) => item.entry);

        await store.update("classes", b.id, { name: "B2" }); // edited while "in flight"
        await acknowledge(db, sent);

        expect(await db.get("outbox", a.id)).toBeUndefined();
        expect(await db.get("outbox", b.id)).toMatchObject({ rev: 2 });
      });

      it("failures keep the entry and count attempts", async () => {
        const a = await store.create("classes", { name: "A", archivedAt: null });
        const sent = (await readOutboxBatch(db, 10)).map((item) => item.entry);
        await markFailed(db, sent, "NETWORK");
        await markFailed(db, sent, "NETWORK");
        expect(await db.get("outbox", a.id)).toMatchObject({ attempts: 2, lastError: "NETWORK" });
      });

      it("a rejection moves the entry to `rejected`; retry or a new edit puts it back", async () => {
        const a = await store.create("classes", { name: "A", archivedAt: null });
        const [item] = await readOutboxBatch(db, 10);
        await reject(db, item!.entry, "REFERENCE_NOT_FOUND", {}, 5_000);

        expect(await db.count("outbox")).toBe(0);
        expect(await db.get("rejected", a.id)).toMatchObject({ code: "REFERENCE_NOT_FOUND" });

        await retryRejected(db, a.id, 6_000);
        expect(await db.count("rejected")).toBe(0);
        expect(await db.get("outbox", a.id)).toMatchObject({ rev: 1 });

        const [again] = await readOutboxBatch(db, 10);
        await reject(db, again!.entry, "REFERENCE_NOT_FOUND", {}, 7_000);
        await store.update("classes", a.id, { name: "fixed" });
        expect(await db.count("rejected")).toBe(0);
        expect(await db.get("outbox", a.id)).toBeDefined();
      });

      it("a rejection of an older revision keeps the newer edit queued", async () => {
        const a = await store.create("classes", { name: "A", archivedAt: null });
        const [item] = await readOutboxBatch(db, 10);
        await store.update("classes", a.id, { name: "A2" });
        await reject(db, item!.entry, "INVALID", {}, 5_000);
        expect(await db.count("rejected")).toBe(0);
        expect(await db.get("outbox", a.id)).toMatchObject({ rev: 2 });
      });
    });

    it("is busy while a write runs and shortly after, and whenIdle waits for it", async () => {
      const writing = store.create("classes", { name: "busy", archivedAt: null });
      expect(store.isBusy()).toBe(true);
      await store.whenIdle();
      expect(store.isBusy()).toBe(false);
      expect((await writing).name).toBe("busy");
      expect(await db.count("outbox")).toBe(1);
    });
  });
}
