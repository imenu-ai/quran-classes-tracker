/** A time zone with a localized label, e.g. "توقيت فلسطين (Asia/Hebron)". */
export interface TimeZoneOption {
  value: string;
  label: string;
}

function localizedName(timeZone: string, locale: string): string {
  try {
    const parts = new Intl.DateTimeFormat(locale, {
      timeZone,
      timeZoneName: "longGeneric",
    }).formatToParts(new Date());
    return parts.find((part) => part.type === "timeZoneName")?.value ?? "";
  } catch {
    return "";
  }
}

/** Every IANA time zone, labelled in `locale` and sorted by label. */
export function timeZoneOptions(locale: string): TimeZoneOption[] {
  const collator = new Intl.Collator(locale);
  return Intl.supportedValuesOf("timeZone")
    .map((value) => {
      const name = localizedName(value, locale);
      return { value, label: name ? `${name} (${value})` : value };
    })
    .sort((a, b) => collator.compare(a.label, b.label));
}
