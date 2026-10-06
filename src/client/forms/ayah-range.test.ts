import { describe, expect, it } from "vitest";
import { checkAyahRange } from "./ayah-range";

describe("checkAyahRange", () => {
  it("accepts a valid range, typed in any digit system", () => {
    expect(checkAyahRange({ surah: 2, from: "١", to: "٥" })).toEqual({
      ok: true,
      value: { surah: 2, fromAyah: 1, toAyah: 5 },
      errors: {},
    });
  });

  it("reports every empty field as REQUIRED", () => {
    const result = checkAyahRange({ surah: null, from: "", to: " " });
    expect(result.ok).toBe(false);
    expect(Object.fromEntries(Object.entries(result.errors).map(([k, v]) => [k, v.code]))).toEqual({
      surah: "REQUIRED",
      fromAyah: "REQUIRED",
      toAyah: "REQUIRED",
    });
  });

  it("puts the sura map's code on the right field", () => {
    expect(checkAyahRange({ surah: 108, from: "1", to: "4" }).errors).toEqual({
      toAyah: { path: "toAyah", code: "AYAH_OUT_OF_RANGE", params: { surah: 108, ayahCount: 3 } },
    });
    expect(checkAyahRange({ surah: 2, from: "9", to: "3" }).errors).toEqual({
      toAyah: { path: "toAyah", code: "FROM_AFTER_TO", params: { fromAyah: 9, toAyah: 3 } },
    });
    expect(checkAyahRange({ surah: 2, from: "0", to: "3" }).errors.fromAyah?.code).toBe(
      "INVALID_AYAH",
    );
    expect(checkAyahRange({ surah: 2, from: "1.5", to: "3" }).errors.fromAyah?.code).toBe(
      "INVALID_AYAH",
    );
  });
});
