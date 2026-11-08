import { describe, expect, it } from "vitest";
import { PAGE_COUNT, pageOf, pageStart, pagesToPortions, portionsMatchPages } from "./pages";
import { getAyahCount, SURAH_COUNT } from "./surahs";

const p = (surah: number, fromAyah: number, toAyah: number) => ({ surah, fromAyah, toAyah });

describe("the page map", () => {
  it("starts every page on an existing ayah, in mushaf order", () => {
    let previous = { surah: 0, ayah: 0 };
    for (let page = 1; page <= PAGE_COUNT; page++) {
      const start = pageStart(page)!;
      expect(start.ayah).toBeGreaterThanOrEqual(1);
      expect(start.ayah).toBeLessThanOrEqual(getAyahCount(start.surah)!);
      const after =
        start.surah > previous.surah ||
        (start.surah === previous.surah && start.ayah > previous.ayah);
      expect(after, `page ${page}`).toBe(true);
      previous = start;
    }
    expect(pageStart(0)).toBeUndefined();
    expect(pageStart(605)).toBeUndefined();
  });

  it("puts every ayah of the Quran on exactly one page", () => {
    const seen = new Map<string, number>();
    for (let page = 1; page <= PAGE_COUNT; page++) {
      for (const portion of pagesToPortions(page, page)) {
        for (let ayah = portion.fromAyah; ayah <= portion.toAyah; ayah++) {
          const key = `${portion.surah}:${ayah}`;
          expect(seen.has(key), key).toBe(false);
          seen.set(key, page);
          expect(pageOf(portion.surah, ayah)).toBe(page);
        }
      }
    }
    let total = 0;
    for (let surah = 1; surah <= SURAH_COUNT; surah++) total += getAyahCount(surah)!;
    expect(seen.size).toBe(total);
    expect(total).toBe(6236);
  });

  it("matches the printed mushaf on known pages", () => {
    expect(pagesToPortions(1, 1)).toEqual([p(1, 1, 7)]);
    expect(pagesToPortions(2, 2)).toEqual([p(2, 1, 5)]);
    // Al-Kahf starts in the middle of page 293.
    expect(pagesToPortions(293, 293)).toEqual([p(17, 105, 111), p(18, 1, 4)]);
    expect(pageStart(562)).toEqual({ surah: 67, ayah: 1 }); // Al-Mulk
    expect(pageStart(582)).toEqual({ surah: 78, ayah: 1 }); // Juz ʿAmma
    expect(pagesToPortions(604, 604)).toEqual([p(112, 1, 4), p(113, 1, 5), p(114, 1, 6)]);
    expect(pagesToPortions(603, 604)).toEqual([
      p(109, 1, 6),
      p(110, 1, 3),
      p(111, 1, 5),
      p(112, 1, 4),
      p(113, 1, 5),
      p(114, 1, 6),
    ]);
  });

  it("gives nothing for a page range that doesn't exist", () => {
    expect(pagesToPortions(0, 1)).toEqual([]);
    expect(pagesToPortions(5, 4)).toEqual([]);
    expect(pagesToPortions(604, 605)).toEqual([]);
    expect(pageOf(2, 287)).toBeUndefined();
  });

  it("knows whether portions are exactly some pages", () => {
    expect(portionsMatchPages([p(17, 105, 111), p(18, 1, 4)], 293, 293)).toBe(true);
    expect(portionsMatchPages([p(18, 1, 4)], 293, 293)).toBe(false);
    expect(portionsMatchPages([p(1, 1, 7)], 1, 2)).toBe(false);
  });
});
