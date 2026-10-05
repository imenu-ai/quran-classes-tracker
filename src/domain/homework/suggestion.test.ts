import { describe, expect, it } from "vitest";
import { validateAyahRange } from "../quran/validation";
import { latestPortion, suggestNextHomework } from "./suggestion";

const p = (surah: number, fromAyah: number, toAyah: number) => ({ surah, fromAyah, toAyah });

describe("suggestNextHomework", () => {
  it("continues in the same sura with the same size", () => {
    expect(suggestNextHomework(p(2, 1, 5), "forward")).toEqual(p(2, 6, 10));
    expect(suggestNextHomework(p(2, 1, 5), "backward")).toEqual(p(2, 6, 10));
  });

  it("never goes past the end of the sura", () => {
    expect(suggestNextHomework(p(2, 271, 280), "forward")).toEqual(p(2, 281, 286));
  });

  it("moves to the next sura when finished (forward), keeping the size if it fits", () => {
    expect(suggestNextHomework(p(78, 31, 40), "forward")).toEqual(p(79, 1, 10));
    expect(suggestNextHomework(p(107, 1, 7), "forward")).toEqual(p(108, 1, 3)); // الكوثر has 3
  });

  it("moves to the previous sura when finished (backward)", () => {
    expect(suggestNextHomework(p(114, 1, 6), "backward")).toEqual(p(113, 1, 5));
    expect(suggestNextHomework(p(79, 41, 46), "backward")).toEqual(p(78, 1, 6));
  });

  it("stops after sura 114 forward and after sura 1 backward", () => {
    expect(suggestNextHomework(p(114, 1, 6), "forward")).toBeNull();
    expect(suggestNextHomework(p(1, 1, 7), "backward")).toBeNull();
  });

  it("continues after a portion that was shortened while evaluating (partial recitation)", () => {
    // Assigned 1–20, recited only 1–10: the edited item now ends at 10.
    expect(suggestNextHomework(p(18, 1, 10), "forward")).toEqual(p(18, 11, 20));
  });

  it("with no history suggests nothing forward and An-Nas backward", () => {
    expect(suggestNextHomework(null, "forward")).toBeNull();
    expect(suggestNextHomework(null, "backward")).toEqual(p(114, 1, 6));
  });

  it("always suggests a range the sura map accepts", () => {
    for (let surah = 1; surah <= 114; surah++) {
      for (const direction of ["forward", "backward"] as const) {
        for (const portion of [p(surah, 1, 1), p(surah, 1, 3)]) {
          const next = suggestNextHomework(portion, direction);
          if (next) expect(validateAyahRange(next.surah, next.fromAyah, next.toAyah).ok).toBe(true);
        }
      }
    }
  });
});

describe("latestPortion", () => {
  const item = (id: string, createdAt: number, deletedAt: number | null = null) => ({
    ...p(2, 1, 5),
    id,
    createdAt,
    deletedAt,
  });

  it("picks the most recently created item, pending or evaluated", () => {
    expect(latestPortion([item("a", 1), item("b", 3), item("c", 2)])?.id).toBe("b");
  });

  it("ignores deleted items and returns null when there are none", () => {
    expect(latestPortion([item("a", 1), item("b", 3, 9)])?.id).toBe("a");
    expect(latestPortion([])).toBeNull();
  });
});
