import { describe, expect, it } from "vitest";
import {
  ageFromBirthYear,
  isLocalDate,
  localDateToUtcDate,
  monthKey,
  todayInTimeZone,
  weekdayOf,
} from "./local-date";

describe("isLocalDate", () => {
  it.each(["2026-10-05", "2024-02-29", "2026-12-31", "2026-01-01"])("accepts %s", (value) => {
    expect(isLocalDate(value)).toBe(true);
  });

  it.each([
    "2026-02-29",
    "2026-02-30",
    "2026-13-01",
    "2026-00-10",
    "2026-1-5",
    "2026/10/05",
    "",
    20261005,
    null,
  ])("rejects %s", (value) => {
    expect(isLocalDate(value)).toBe(false);
  });
});

describe("todayInTimeZone", () => {
  it("uses the given time zone, not the device's", () => {
    // 22:30 UTC on Oct 5 is already Oct 6 in Hebron (UTC+3 in summer time).
    const lateUtc = new Date("2026-10-05T22:30:00Z");
    expect(todayInTimeZone("Asia/Hebron", lateUtc)).toBe("2026-10-06");
    expect(todayInTimeZone("UTC", lateUtc)).toBe("2026-10-05");
  });

  it("handles winter time (UTC+2) around midnight", () => {
    expect(todayInTimeZone("Asia/Hebron", new Date("2026-12-31T21:59:00Z"))).toBe("2026-12-31");
    expect(todayInTimeZone("Asia/Hebron", new Date("2026-12-31T22:00:00Z"))).toBe("2027-01-01");
  });

  it("always returns a valid local date", () => {
    expect(isLocalDate(todayInTimeZone("Asia/Hebron"))).toBe(true);
  });
});

describe("ageFromBirthYear", () => {
  it("subtracts the birth year from the current year", () => {
    expect(ageFromBirthYear(2014, "2026-10-05")).toBe(12);
    expect(ageFromBirthYear(2014, "2026-01-01")).toBe(12);
  });

  it("never goes below zero", () => {
    expect(ageFromBirthYear(2026, "2026-10-05")).toBe(0);
    expect(ageFromBirthYear(2027, "2026-10-05")).toBe(0);
  });
});

describe("weekdayOf / monthKey / localDateToUtcDate", () => {
  it("derives the weekday from the calendar date alone", () => {
    expect(weekdayOf("2026-10-05")).toBe(1); // Monday
    expect(weekdayOf("2026-10-04")).toBe(0); // Sunday
    expect(weekdayOf("2026-10-10")).toBe(6); // Saturday
    expect(weekdayOf("2024-02-29")).toBe(4); // leap day, Thursday
  });

  it("formats (in UTC) to the same calendar day and weekday", () => {
    const date = localDateToUtcDate("2026-10-05");
    expect(date.toISOString()).toBe("2026-10-05T00:00:00.000Z");
    const parts = (locale: string) =>
      Object.fromEntries(
        new Intl.DateTimeFormat(locale, { timeZone: "UTC", weekday: "long", day: "numeric" })
          .formatToParts(date)
          .filter((part) => part.type !== "literal")
          .map((part) => [part.type, part.value]),
      );
    expect(parts("en-US")).toEqual({ weekday: "Monday", day: "5" });
    expect(parts("ar-u-nu-latn")).toEqual({ weekday: "الاثنين", day: "5" });
  });

  it("uses the month of the lesson date", () => {
    expect(monthKey("2026-10-31")).toBe("2026-10");
    expect(monthKey("2027-01-01")).toBe("2027-01");
  });
});
