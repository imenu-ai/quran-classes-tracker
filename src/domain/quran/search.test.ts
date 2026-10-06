import { describe, expect, it } from "vitest";
import { normalizeForSearch, searchSurahs } from "@/domain/quran/search";
import { SURAHS } from "@/domain/quran/surahs";

const numbers = (query: string, locale = "ar") => searchSurahs(query, locale).map((s) => s.number);

describe("normalizeForSearch", () => {
  it("removes tashkeel", () => {
    expect(normalizeForSearch("مُحَمَّدٌ")).toBe("محمد");
    expect(normalizeForSearch("الْفَاتِحَةِ")).toBe(normalizeForSearch("الفاتحة"));
  });

  it("removes tatweel", () => {
    expect(normalizeForSearch("محـــمد")).toBe("محمد");
  });

  it("folds أ إ آ ٱ to ا", () => {
    expect(normalizeForSearch("أإآٱا")).toBe("ااااا");
    expect(normalizeForSearch("الإسراء")).toBe(normalizeForSearch("الاسراء"));
    expect(normalizeForSearch("آل عمران")).toBe(normalizeForSearch("ال عمران"));
  });

  it("folds ة to ه and ى to ي", () => {
    expect(normalizeForSearch("البقرة")).toBe("البقره");
    expect(normalizeForSearch("الضحى")).toBe("الضحي");
  });

  it("converts Arabic-Indic digits", () => {
    expect(normalizeForSearch("١١٤")).toBe("114");
  });

  it("lowercases and ignores spaces and punctuation", () => {
    expect(normalizeForSearch("Al-Ma'idah")).toBe("almaidah");
    expect(normalizeForSearch("  al maidah ")).toBe("almaidah");
  });
});

describe("searchSurahs", () => {
  it("returns every sura for an empty query", () => {
    expect(searchSurahs("", "ar")).toBe(SURAHS);
    expect(searchSurahs("   ", "ar")).toBe(SURAHS);
  });

  it('finds "الإسراء" when typing "الاسراء"', () => {
    expect(numbers("الاسراء")[0]).toBe(17);
  });

  it("finds a sura when typed with or without tashkeel", () => {
    expect(numbers("البَقَرَة")[0]).toBe(2);
    expect(numbers("بقره")[0]).toBe(2);
  });

  it("matches آل عمران without the hamza", () => {
    expect(numbers("ال عمران")).toContain(3);
  });

  it("matches by number, exact match first", () => {
    expect(numbers("2")[0]).toBe(2);
    expect(numbers("11")).toEqual([11, 110, 111, 112, 113, 114]);
    expect(numbers("٢")[0]).toBe(2);
  });

  it("returns no results for an unknown number", () => {
    expect(numbers("200")).toEqual([]);
  });

  it("ranks prefix matches before substring matches", () => {
    // "النا" prefixes الناس (114) and النازعات (79); النبأ doesn't match.
    expect(numbers("النا").slice(0, 2)).toEqual([79, 114]);
  });

  it("searches English names only when the locale is en", () => {
    expect(numbers("baqarah", "en")).toEqual([2]);
    expect(numbers("baqarah", "ar")).toEqual([]);
  });

  it("always searches Arabic names, even in en", () => {
    expect(numbers("الكهف", "en")).toEqual([18]);
  });

  it("falls back to Arabic for a locale without names", () => {
    expect(numbers("الكهف", "fr")).toEqual([18]);
  });
});
