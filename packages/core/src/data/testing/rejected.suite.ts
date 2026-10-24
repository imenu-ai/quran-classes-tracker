import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { classRecord } from "../../test/records";
import { CURSOR_KEY, getCursor } from "../sync/apply-pull";
import { discardRejected } from "../sync/rejected";
import type { LocalDatabase } from "../database";
import { openTestDevice, putRecord, type StorageFactory, type TestDevice } from "./harness";

export function rejectedSuite(factory: StorageFactory) {
  describe("discardRejected", () => {
    let device: TestDevice;
    let db: LocalDatabase;

    beforeEach(async () => {
      device = await openTestDevice(factory);
      ({ db } = device);
      await putRecord(db, "meta", { key: CURSOR_KEY, value: 42 });
    });

    afterEach(async () => {
      await device.destroy();
    });

    const reject = (recordId: string) =>
      putRecord(db, "rejected", {
        recordId,
        table: "classes",
        code: "FORBIDDEN",
        params: {},
        rejectedAt: 1,
      });

    it("removes a record that never reached the server", async () => {
      const local = classRecord({ serverVersion: 0 });
      await putRecord(db, "classes", local);
      await reject(local.id);
      await discardRejected(db, local.id);
      expect(await db.get("classes", local.id)).toBeUndefined();
      expect(await db.count("rejected")).toBe(0);
      expect(await getCursor(db)).toBe(42);
    });

    it("re-pulls a synced record so the server's version comes back", async () => {
      const synced = classRecord({ serverVersion: 7, name: "local edit the server refused" });
      await putRecord(db, "classes", synced);
      await reject(synced.id);
      await discardRejected(db, synced.id);
      expect(await db.get("classes", synced.id)).toBeDefined();
      expect(await db.count("rejected")).toBe(0);
      expect(await getCursor(db)).toBe(0);
    });

    it("does nothing for an unknown id", async () => {
      await discardRejected(db, "missing");
      expect(await getCursor(db)).toBe(42);
    });
  });
}
