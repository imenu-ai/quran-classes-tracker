import { describe, expect, it } from "vitest";
import { validateAyahRange } from "@/domain/quran/validation";

describe("validateAyahRange", () => {
  describe("valid ranges", () => {
    it.each([
      ["first ayah only", 2, 1, 1],
      ["last ayah only", 2, 286, 286],
      ["whole sura", 2, 1, 286],
      ["first ayah of the first sura", 1, 1, 7],
      ["last ayah of the last sura", 114, 6, 6],
      ["middle range", 9, 30, 60],
    ])("accepts %s", (_label, surah, from, to) => {
      expect(validateAyahRange(surah, from, to)).toEqual({ ok: true });
    });
  });

  describe("SURAH_NOT_FOUND", () => {
    it.each([0, 115, -1, 2.5, Number.NaN, "2", null, undefined])("rejects sura %s", (surah) => {
      expect(validateAyahRange(surah, 1, 1)).toEqual({
        ok: false,
        code: "SURAH_NOT_FOUND",
        field: "surah",
        params: {},
      });
    });

    it("is checked before the ayahs", () => {
      expect(validateAyahRange(115, 0, -3)).toMatchObject({ code: "SURAH_NOT_FOUND" });
    });
  });

  describe("INVALID_AYAH", () => {
    it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, "1", null])(
      "rejects fromAyah %s",
      (from) => {
        expect(validateAyahRange(2, from, 5)).toEqual({
          ok: false,
          code: "INVALID_AYAH",
          field: "fromAyah",
          params: {},
        });
      },
    );

    it.each([0, -7, 3.2, undefined])("rejects toAyah %s", (to) => {
      expect(validateAyahRange(2, 1, to)).toEqual({
        ok: false,
        code: "INVALID_AYAH",
        field: "toAyah",
        params: {},
      });
    });
  });

  describe("AYAH_OUT_OF_RANGE", () => {
    it("rejects a toAyah above the sura's ayah count", () => {
      expect(validateAyahRange(2, 280, 287)).toEqual({
        ok: false,
        code: "AYAH_OUT_OF_RANGE",
        field: "toAyah",
        params: { surah: 2, ayahCount: 286 },
      });
    });

    it("rejects a fromAyah above the sura's ayah count", () => {
      expect(validateAyahRange(108, 4, 4)).toEqual({
        ok: false,
        code: "AYAH_OUT_OF_RANGE",
        field: "fromAyah",
        params: { surah: 108, ayahCount: 3 },
      });
    });

    it("is checked before FROM_AFTER_TO", () => {
      expect(validateAyahRange(1, 9, 8)).toMatchObject({ code: "AYAH_OUT_OF_RANGE" });
    });
  });

  describe("FROM_AFTER_TO", () => {
    it("rejects fromAyah after toAyah", () => {
      expect(validateAyahRange(2, 10, 9)).toEqual({
        ok: false,
        code: "FROM_AFTER_TO",
        field: "toAyah",
        params: { fromAyah: 10, toAyah: 9 },
      });
    });
  });
});
