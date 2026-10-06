import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { classRecord } from "@/test/records";
import { openLocalDb, type LocalDb } from "../db/dexie";
import { CURSOR_KEY, getCursor } from "./apply-pull";
import { discardRejected } from "./rejected";

describe("discardRejected", () => {
  let db: LocalDb;

  beforeEach(async () => {
    db = openLocalDb(`rejected-${crypto.randomUUID()}`);
    await db.meta.put({ key: CURSOR_KEY, value: 42 });
  });

  afterEach(async () => {
    await db.delete();
  });

  const reject = (recordId: string) =>
    db.rejected.put({ recordId, table: "classes", code: "FORBIDDEN", params: {}, rejectedAt: 1 });

  it("removes a record that never reached the server", async () => {
    const local = classRecord({ serverVersion: 0 });
    await db.classes.put(local);
    await reject(local.id);
    await discardRejected(db, local.id);
    expect(await db.classes.get(local.id)).toBeUndefined();
    expect(await db.rejected.count()).toBe(0);
    expect(await getCursor(db)).toBe(42);
  });

  it("re-pulls a synced record so the server's version comes back", async () => {
    const synced = classRecord({ serverVersion: 7, name: "local edit the server refused" });
    await db.classes.put(synced);
    await reject(synced.id);
    await discardRejected(db, synced.id);
    expect(await db.classes.get(synced.id)).toBeDefined();
    expect(await db.rejected.count()).toBe(0);
    expect(await getCursor(db)).toBe(0);
  });

  it("does nothing for an unknown id", async () => {
    await discardRejected(db, "missing");
    expect(await getCursor(db)).toBe(42);
  });
});
