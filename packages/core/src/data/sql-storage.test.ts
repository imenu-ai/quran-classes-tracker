import { describe, expect, it } from "vitest";
import { classRecord } from "../test/records";
import { createSqlStorage } from "./sql-storage";
import { createNodeSqliteDriver } from "./testing/node-sqlite-driver";
import { dataLayerSuites } from "./testing/suites";

describe("SQLite adapter (node:sqlite)", () => {
  dataLayerSuites(() => createSqlStorage(createNodeSqliteDriver()));

  it("migrates once: reopening an up-to-date database changes nothing", async () => {
    const driver = createNodeSqliteDriver();
    const first = await createSqlStorage(driver);
    await first.transaction((tx) => tx.put("classes", classRecord({ id: "c1" })));
    const again = await createSqlStorage(driver);
    expect(await again.count("classes")).toBe(1);
    expect(await driver.all("PRAGMA user_version")).toEqual([{ user_version: 1 }]);
    await driver.destroy();
  });

  it("writes and reads more rows than one statement holds", async () => {
    const storage = await createSqlStorage(createNodeSqliteDriver());
    const ids = Array.from({ length: 250 }, (_, i) => `c${String(i).padStart(3, "0")}`);
    await storage.transaction((tx) =>
      tx.bulkPut(
        "classes",
        ids.map((id) => classRecord({ id })),
      ),
    );
    expect(await storage.count("classes")).toBe(250);
    expect((await storage.bulkGet("classes", ids)).every(Boolean)).toBe(true);
    await storage.transaction((tx) => tx.bulkDelete("classes", ids.slice(0, 201)));
    expect(await storage.count("classes")).toBe(49);
    await storage.destroy();
  });
});
