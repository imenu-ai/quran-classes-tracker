import { describe, expect, it } from "vitest";
import { isLocalDate } from "./local-date";

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
