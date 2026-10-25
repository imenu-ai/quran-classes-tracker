import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { TABLE_SCHEMA } from "@qct/core/data/storage";
import { dataLayerSuites } from "@qct/core/data/testing/suites";
import { classRecord } from "@qct/core/test/records";
import { createDexieStorage, LocalDb, localDbName, openLocalDatabase } from "./dexie";

describe("LocalDb", () => {
  it("names the database per user", () => {
    expect(localDbName("u1")).toBe("qct-u1");
  });

  it("has exactly core's tables, keys and indexes", async () => {
    const db = new LocalDb(`schema-${crypto.randomUUID()}`);
    await db.open();
    const actual = Object.fromEntries(
      db.tables.map((table) => [
        table.name,
        { key: table.schema.primKey.keyPath, indexes: table.schema.indexes.map((i) => i.name) },
      ]),
    );
    const expected = Object.fromEntries(
      Object.entries(TABLE_SCHEMA).map(([name, { key, indexes }]) => [
        name,
        { key, indexes: [...indexes] },
      ]),
    );
    expect(actual).toEqual(expected);
    await db.delete();
  });

  it("deletes the IndexedDB database on destroy", async () => {
    const userId = `gone-${crypto.randomUUID()}`;
    const db = openLocalDatabase(userId);
    await db.transaction((tx) => tx.put("meta", { key: "cursor", value: 1 }));
    await db.destroy();
    const reopened = openLocalDatabase(userId);
    expect(await reopened.count("meta")).toBe(0);
    await reopened.destroy();
  });

  it("keeps two users' data apart", async () => {
    const alice = openLocalDatabase(`alice-${crypto.randomUUID()}`);
    const bob = openLocalDatabase(`bob-${crypto.randomUUID()}`);
    await alice.transaction((tx) => tx.put("classes", classRecord()));
    expect(await bob.count("classes")).toBe(0);
    await alice.destroy();
    await bob.destroy();
  });
});

describe("Dexie adapter", () => {
  dataLayerSuites(() => createDexieStorage(new LocalDb(`suite-${crypto.randomUUID()}`)));
});
