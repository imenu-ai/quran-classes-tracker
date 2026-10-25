import { describe, expect, it } from "vitest";
import { getIntlLocale, parseEnabledLocales, resolveLocale, toAppLocale } from "./config";

describe("parseEnabledLocales", () => {
  it("defaults to ar only", () => {
    expect(parseEnabledLocales(undefined)).toEqual(["ar"]);
    expect(parseEnabledLocales("")).toEqual(["ar"]);
  });

  it("parses a comma-separated list and ignores unknown locales", () => {
    expect(parseEnabledLocales("ar, en")).toEqual(["ar", "en"]);
    expect(parseEnabledLocales("en,xx")).toEqual(["ar", "en"]);
  });
});

describe("resolveLocale", () => {
  it("uses the candidate when it is enabled", () => {
    expect(resolveLocale("en", ["ar", "en"])).toBe("en");
  });

  it("falls back to ar when the candidate is disabled, unknown or missing", () => {
    expect(resolveLocale("en", ["ar"])).toBe("ar");
    expect(resolveLocale("xx", ["ar", "en"])).toBe("ar");
    expect(resolveLocale(undefined, ["ar", "en"])).toBe("ar");
  });
});

describe("Intl locale tags", () => {
  it("pins Western digits and the Gregorian calendar", () => {
    const tag = getIntlLocale("ar");
    const options = new Intl.DateTimeFormat(tag).resolvedOptions();
    expect(options.numberingSystem).toBe("latn");
    expect(options.calendar).toBe("gregory");
    expect(new Intl.NumberFormat(tag).format(1234.5)).toBe("1,234.5");
  });

  it("maps a tag back to the app locale", () => {
    expect(toAppLocale(getIntlLocale("ar"))).toBe("ar");
    expect(toAppLocale(getIntlLocale("en"))).toBe("en");
    expect(toAppLocale("xx")).toBe("ar");
    expect(toAppLocale("")).toBe("ar");
  });
});
