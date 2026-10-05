/** A local calendar date "YYYY-MM-DD" (no time, no time zone). */
export type LocalDate = string;

const LOCAL_DATE_PATTERN = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;

/** True for a real calendar date in "YYYY-MM-DD" form (rejects 2026-02-30). */
export function isLocalDate(value: unknown): value is LocalDate {
  if (typeof value !== "string" || !LOCAL_DATE_PATTERN.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number) as [number, number, number];
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

/**
 * Today's calendar date in a time zone (the tenant's, e.g. Asia/Hebron),
 * independent of the device's own time zone setting.
 */
export function todayInTimeZone(timeZone: string, now: Date = new Date()): LocalDate {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/**
 * Age in years from a birth year, as of `today`. Only the birth year is
 * known, so this is the age the student turns during the current year.
 */
export function ageFromBirthYear(birthYear: number, today: LocalDate): number {
  return Math.max(0, Number(today.slice(0, 4)) - birthYear);
}
