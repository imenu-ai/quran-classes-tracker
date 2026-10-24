import { describe, expect, it } from "vitest";
import { getDirection } from "./direction";

describe("getDirection", () => {
  it.each(["ar", "ar-u-ca-gregory-nu-latn", "ar-PS", "he", "fa", "ur"])("%s is rtl", (locale) => {
    expect(getDirection(locale)).toBe("rtl");
  });

  it.each(["en", "en-US", "fr", "tr", "id"])("%s is ltr", (locale) => {
    expect(getDirection(locale)).toBe("ltr");
  });

  it("falls back to ltr for an invalid tag", () => {
    expect(getDirection("")).toBe("ltr");
    expect(getDirection("not a locale")).toBe("ltr");
  });
});
