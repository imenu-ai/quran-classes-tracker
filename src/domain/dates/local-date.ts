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
