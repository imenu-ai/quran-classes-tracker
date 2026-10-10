import type { Formats } from "next-intl";

/**
 * Named formats used with next-intl's `format.dateTime(date, name)` and
 * `format.number(n, name)`. Lesson dates are calendar dates (YYYY-MM-DD) and
 * are formatted in UTC so the day never shifts with the device time zone.
 */
export const formats = {
  dateTime: {
    lessonDate: { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" },
    lessonDateShort: { day: "numeric", month: "numeric", year: "numeric", timeZone: "UTC" },
    weekday: { weekday: "long", timeZone: "UTC" },
    // Month table rows: "الأحد 5".
    dayShort: { weekday: "short", day: "numeric", timeZone: "UTC" },
    month: { month: "long", year: "numeric", timeZone: "UTC" },
    monthShort: { month: "short", year: "2-digit", timeZone: "UTC" },
  },
  number: {
    // Monthly averages: one decimal place.
    average: { minimumFractionDigits: 1, maximumFractionDigits: 1 },
  },
} satisfies Formats;
