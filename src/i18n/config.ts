/** Every locale the app has messages for. */
export const LOCALES = ["ar", "en"] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "ar";

/** Cookie that carries the active locale (copied from `user.locale` at login). */
export const LOCALE_COOKIE = "NEXT_LOCALE";

/** Fallback time zone until the tenant's own time zone is known. */
export const DEFAULT_TIME_ZONE = "Asia/Hebron";

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/**
 * Parses `ENABLED_LOCALES` (comma-separated, e.g. "ar" or "ar,en"). Unknown
 * entries are ignored and the default locale is always enabled.
 */
export function parseEnabledLocales(value: string | undefined): readonly Locale[] {
  const requested = (value ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(isLocale);
  return [...new Set<Locale>([DEFAULT_LOCALE, ...requested])];
}

/** The candidate locale if it is enabled, otherwise the default locale. */
export function resolveLocale(candidate: unknown, enabled: readonly Locale[]): Locale {
  return isLocale(candidate) && enabled.includes(candidate) ? candidate : DEFAULT_LOCALE;
}

/**
 * The BCP 47 tag handed to `Intl` (through next-intl) for a locale. It pins
 * Western digits (`nu-latn`) and the Gregorian calendar (`ca-gregory`), so
 * every device formats the same way regardless of its own CLDR defaults.
 */
export function getIntlLocale(locale: Locale): string {
  return `${locale}-u-ca-gregory-nu-latn`;
}

/** Maps an Intl tag (e.g. "ar-u-ca-gregory-nu-latn") back to the app locale. */
export function toAppLocale(intlLocale: string): Locale {
  let language: string;
  try {
    language = new Intl.Locale(intlLocale).language;
  } catch {
    return DEFAULT_LOCALE;
  }
  return isLocale(language) ? language : DEFAULT_LOCALE;
}
