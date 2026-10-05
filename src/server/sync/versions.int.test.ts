import type { Db } from "mongodb";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startTestMongo } from "@/test/mongo";
import { allocateVersions, getWatermark, IN_FLIGHT_TTL_MS } from "./versions";

describe("version allocation", () => {
  let db: Db;
  let stop: () => Promise<void>;

  beforeAll(async () => {
    ({ db, stop } = await startTestMongo());
  });

  afterAll(async () => {
    await stop();
  });

  it("starts at 1 for a new tenant and counts up", async () => {
    const first = await allocateVersions(db, "t-new", 3);
    expect(first.from).toBe(1);
    const second = await allocateVersions(db, "t-new", 2);
    expect(second.from).toBe(4);
    await first.release();
    await second.release();
    expect(await getWatermark(db, "t-new")).toBe(5);
  });

  it("never hands out the same version twice under concurrency", async () => {
    const sizes = Array.from({ length: 25 }, (_, i) => (i % 5) + 1);
    const allocations = await Promise.all(sizes.map((n) => allocateVersions(db, "t-conc", n)));

    const versions = allocations.flatMap((a) =>
      Array.from({ length: a.count }, (_, i) => a.from + i),
    );
    const total = sizes.reduce((sum, n) => sum + n, 0);
    expect(new Set(versions).size).toBe(total);
    expect(Math.min(...versions)).toBe(1);
    expect(Math.max(...versions)).toBe(total);

    await Promise.all(allocations.map((a) => a.release()));
    expect(await getWatermark(db, "t-conc")).toBe(total);
  });

  it("keeps the watermark below a range that hasn't been released", async () => {
    const pending = await allocateVersions(db, "t-wm", 2); // versions 1–2
    const done = await allocateVersions(db, "t-wm", 3); // versions 3–5
    await done.release();

    // Versions 3–5 are written but 1–2 may not be yet: hand out nothing past 0.
    expect(await getWatermark(db, "t-wm")).toBe(0);

    await pending.release();
    expect(await getWatermark(db, "t-wm")).toBe(5);
  });

  it("ignores reservations older than the TTL (an abandoned request)", async () => {
    const longAgo = new Date(Date.now() - IN_FLIGHT_TTL_MS - 1_000);
    await allocateVersions(db, "t-stale", 2, longAgo); // never released
    const fresh = await allocateVersions(db, "t-stale", 1);
    await fresh.release();
    expect(await getWatermark(db, "t-stale")).toBe(3);
  });

  it("returns 0 for a tenant that never wrote anything", async () => {
    expect(await getWatermark(db, "t-none")).toBe(0);
  });

  it("rejects a non-positive count", async () => {
    await expect(allocateVersions(db, "t-bad", 0)).rejects.toThrow();
  });
});
