import { describe, expect, it } from "vitest";
import { parseIntegerInput, toWesternDigits } from "./digits";

describe("toWesternDigits", () => {
  it("converts Arabic-Indic and Eastern Arabic-Indic digits", () => {
    expect(toWesternDigits("٢٠١٤")).toBe("2014");
    expect(toWesternDigits("۲۰۱۴")).toBe("2014");
    expect(toWesternDigits("abc 12")).toBe("abc 12");
  });
});

describe("parseIntegerInput", () => {
  it("parses whole numbers in any digit system", () => {
    expect(parseIntegerInput(" 2014 ")).toBe(2014);
    expect(parseIntegerInput("٢٨٦")).toBe(286);
  });

  it("returns undefined for an empty field and NaN for non-numbers", () => {
    expect(parseIntegerInput("  ")).toBeUndefined();
    expect(parseIntegerInput("12a")).toBeNaN();
    expect(parseIntegerInput("1.5")).toBeNaN();
  });
});
