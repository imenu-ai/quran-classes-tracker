import { describe, expect, it } from "vitest";
import { isLocalDate, todayInTimeZone } from "./local-date";

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
