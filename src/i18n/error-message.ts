import { AYAH_RANGE_ERROR_CODES, type AyahRangeErrorCode } from "@/domain/quran/validation";
import { getSurahName } from "@/domain/quran/surahs";
import type { ErrorParams, FieldError } from "@/shared/schemas/errors";
import type { Locale } from "./config";

/** The subset of a next-intl translator scoped to the `errors` namespace. */
export interface ErrorsTranslator {
  (key: string, values?: Record<string, string | number>): string;
  has(key: string): boolean;
}

const isAyahRangeCode = (code: string): code is AyahRangeErrorCode =>
  (AYAH_RANGE_ERROR_CODES as readonly string[]).includes(code);

/**
 * Turns an error code from the domain or a schema into localized text.
 * AYAH_OUT_OF_RANGE carries the sura number; its name is resolved here in
 * the active locale so domain code stays locale-free.
 */
export function translateError(
  t: ErrorsTranslator,
  error: Pick<FieldError, "code" | "params">,
  locale: Locale,
): string {
  if (isAyahRangeCode(error.code)) {
    const values: ErrorParams = { ...error.params };
    if (typeof error.params.surah === "number") {
      values.surahName = getSurahName(error.params.surah, locale) ?? String(error.params.surah);
    }
    return t(`ayahRange.${error.code}`, values);
  }
  const key = `validation.${error.code}`;
  return t.has(key) ? t(key, error.params) : t("validation.INVALID");
}
