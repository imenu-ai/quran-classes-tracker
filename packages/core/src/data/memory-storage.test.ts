import { describe, expect, it } from "vitest";
import { compareKeys, createMemoryStorage } from "./memory-storage";
import { dataLayerSuites } from "./testing/suites";

describe("compareKeys (IndexedDB order)", () => {
  it("orders numbers before strings before arrays, and arrays element by element", () => {
    const keys = [["a", "2"], "b", 10, ["a", "10"], "a", 2, ["a"]];
    expect([...keys].sort(compareKeys)).toEqual([2, 10, "a", "b", ["a"], ["a", "10"], ["a", "2"]]);
  });
});

describe("memory adapter", () => {
  dataLayerSuites(createMemoryStorage);

  it("is empty after destroy", async () => {
    const storage = createMemoryStorage();
    await storage.transaction((tx) => tx.put("meta", { key: "cursor", value: 1 }));
    await storage.destroy();
    expect(await storage.count("meta")).toBe(0);
  });
});
