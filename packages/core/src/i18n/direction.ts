export type Direction = "rtl" | "ltr";

// Languages written right-to-left (ISO 639 codes).
const RTL_LANGUAGES = new Set(["ar", "arc", "ckb", "dv", "fa", "he", "ps", "sd", "ug", "ur", "yi"]);

/**
 * The text direction for a locale or BCP 47 tag ("ar", "en", "ar-u-nu-latn").
 * This is the only place direction is derived; never hardcode `dir`.
 */
export function getDirection(locale: string): Direction {
  const language = languageOf(locale);
  return language !== undefined && RTL_LANGUAGES.has(language) ? "rtl" : "ltr";
}

/**
 * The language subtag of a BCP 47 tag ("ar-u-ca-gregory-nu-latn" → "ar"),
 * lowercased, or undefined when it isn't one. Parsed by hand rather than with
 * `Intl.Locale`, which Hermes (the mobile app's engine) doesn't have: without
 * it, Arabic would silently fall back to LTR.
 */
export function languageOf(tag: string): string | undefined {
  const language = tag.trim().split(/[-_]/)[0]?.toLowerCase() ?? "";
  return /^[a-z]{2,8}$/.test(language) ? language : undefined;
}
