import { getAyahCount, isValidSurah } from "./surahs";

/**
 * Error codes returned by {@link validateAyahRange}. The UI turns a code into
 * text through i18n (`errors.ayahRange.<CODE>`); domain code never returns text.
 */
export const AYAH_RANGE_ERROR_CODES = [
  "SURAH_NOT_FOUND",
  "INVALID_AYAH",
  "AYAH_OUT_OF_RANGE",
  "FROM_AFTER_TO",
] as const;

export type AyahRangeErrorCode = (typeof AYAH_RANGE_ERROR_CODES)[number];

/** Which input an error belongs to, so a form can show it next to that field. */
export type AyahRangeField = "surah" | "fromAyah" | "toAyah";

export type AyahRangeError =
  | { ok: false; code: "SURAH_NOT_FOUND"; field: "surah"; params: Record<string, never> }
  | { ok: false; code: "INVALID_AYAH"; field: "fromAyah" | "toAyah"; params: Record<string, never> }
  | {
      ok: false;
      code: "AYAH_OUT_OF_RANGE";
      field: "fromAyah" | "toAyah";
      /**
       * `surah` is the number; the UI resolves it to the localized sura name
       * (`surahName` in the message) so the domain stays locale-free.
       */
      params: { surah: number; ayahCount: number };
    }
  | {
      ok: false;
      code: "FROM_AFTER_TO";
      field: "toAyah";
      params: { fromAyah: number; toAyah: number };
    };

export type AyahRangeResult = { ok: true } | AyahRangeError;

const isPositiveInteger = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= 1;

/**
 * Validates one homework portion: a single sura, from ayah → to ayah.
 * Rules are checked in order and the first failure is returned:
 * 1. the sura is an integer 1–114,
 * 2. both ayahs are integers ≥ 1,
 * 3. both ayahs are ≤ the sura's ayah count,
 * 4. fromAyah ≤ toAyah.
 */
export function validateAyahRange(
  surah: unknown,
  fromAyah: unknown,
  toAyah: unknown,
): AyahRangeResult {
  if (!isValidSurah(surah)) {
    return { ok: false, code: "SURAH_NOT_FOUND", field: "surah", params: {} };
  }
  if (!isPositiveInteger(fromAyah)) {
    return { ok: false, code: "INVALID_AYAH", field: "fromAyah", params: {} };
  }
  if (!isPositiveInteger(toAyah)) {
    return { ok: false, code: "INVALID_AYAH", field: "toAyah", params: {} };
  }

  // isValidSurah guarantees the sura exists.
  const ayahCount = getAyahCount(surah)!;
  if (fromAyah > ayahCount) {
    return {
      ok: false,
      code: "AYAH_OUT_OF_RANGE",
      field: "fromAyah",
      params: { surah, ayahCount },
    };
  }
  if (toAyah > ayahCount) {
    return { ok: false, code: "AYAH_OUT_OF_RANGE", field: "toAyah", params: { surah, ayahCount } };
  }
  if (fromAyah > toAyah) {
    return { ok: false, code: "FROM_AFTER_TO", field: "toAyah", params: { fromAyah, toAyah } };
  }
  return { ok: true };
}
