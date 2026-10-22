export type Direction = "rtl" | "ltr";

// Languages written right-to-left (ISO 639 codes).
const RTL_LANGUAGES = new Set(["ar", "arc", "ckb", "dv", "fa", "he", "ps", "sd", "ug", "ur", "yi"]);

/**
 * The text direction for a locale or BCP 47 tag ("ar", "en", "ar-u-nu-latn").
 * This is the only place direction is derived; never hardcode `dir`.
 */
export function getDirection(locale: string): Direction {
  let language: string;
  try {
    language = new Intl.Locale(locale).language;
  } catch {
    return "ltr";
  }
  return RTL_LANGUAGES.has(language) ? "rtl" : "ltr";
}
