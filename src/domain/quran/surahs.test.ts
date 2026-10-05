import { describe, expect, it } from "vitest";
import {
  getAyahCount,
  getSurah,
  getSurahName,
  isValidSurah,
  SURAH_COUNT,
  SURAH_MAP,
  SURAHS,
} from "@/domain/quran/surahs";

describe("SURAHS", () => {
  it("has exactly 114 entries", () => {
    expect(SURAHS).toHaveLength(114);
    expect(SURAH_COUNT).toBe(114);
  });

  it("is numbered 1–114 in order with no gaps", () => {
    SURAHS.forEach((surah, index) => {
      expect(surah.number).toBe(index + 1);
    });
  });

  it("totals 6236 ayahs", () => {
    const total = SURAHS.reduce((sum, surah) => sum + surah.ayahCount, 0);
    expect(total).toBe(6236);
  });

  it.each([
    [1, 7],
    [2, 286],
    [9, 129],
    [108, 3],
    [114, 6],
  ])("sura %i has %i ayahs", (number, ayahCount) => {
    expect(getAyahCount(number)).toBe(ayahCount);
  });

  it("gives every sura non-empty ar and en names and a positive integer ayah count", () => {
    for (const surah of SURAHS) {
      expect(surah.names.ar.trim()).not.toBe("");
      expect(surah.names.en.trim()).not.toBe("");
      expect(Number.isInteger(surah.ayahCount)).toBe(true);
      expect(surah.ayahCount).toBeGreaterThan(0);
    }
  });

  it("is immutable", () => {
    expect(Object.isFrozen(SURAHS)).toBe(true);
    expect(Object.isFrozen(SURAHS[0])).toBe(true);
    expect(Object.isFrozen(SURAHS[0]?.names)).toBe(true);
  });
});

describe("SURAH_MAP and getSurah", () => {
  it("maps every number to the same entry as SURAHS", () => {
    expect(SURAH_MAP.size).toBe(114);
    for (const surah of SURAHS) {
      expect(SURAH_MAP.get(surah.number)).toBe(surah);
      expect(getSurah(surah.number)).toBe(surah);
    }
  });

  it("returns undefined for unknown numbers", () => {
    expect(getSurah(0)).toBeUndefined();
    expect(getSurah(115)).toBeUndefined();
    expect(getAyahCount(115)).toBeUndefined();
  });
});

describe("isValidSurah", () => {
  it.each([1, 57, 114])("accepts %i", (number) => {
    expect(isValidSurah(number)).toBe(true);
  });

  it.each([0, 115, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, "2", null, undefined])(
    "rejects %s",
    (value) => {
      expect(isValidSurah(value)).toBe(false);
    },
  );
});

describe("getSurahName", () => {
  it("returns the name in the requested locale", () => {
    expect(getSurahName(2, "ar")).toBe("البقرة");
    expect(getSurahName(2, "en")).toBe("Al-Baqarah");
    expect(getSurahName(17, "ar")).toBe("الإسراء");
  });

  it("falls back to Arabic for a locale without names", () => {
    expect(getSurahName(2, "fr")).toBe("البقرة");
    expect(getSurahName(114, "")).toBe("الناس");
    expect(getSurahName(1, "constructor")).toBe("الفاتحة");
  });

  it("returns undefined for an unknown sura", () => {
    expect(getSurahName(0, "ar")).toBeUndefined();
    expect(getSurahName(115, "en")).toBeUndefined();
  });
});
