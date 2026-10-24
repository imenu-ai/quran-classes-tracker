import { createFormatter, createTranslator } from "use-intl/core";
import ar from "@qct/core/messages/ar.json";
import { getIntlLocale } from "@qct/core/i18n/config";
import { getDirection } from "@qct/core/i18n/direction";
import { formats } from "@qct/core/i18n/formats";

/**
 * Hermes has no Intl.PluralRules, Intl.Locale, Intl.RelativeTimeFormat or
 * Intl.supportedValuesOf. Node has them all, so they're removed here first:
 * what's tested is the app on FormatJS's polyfills and locale data.
 */
const MISSING_ON_HERMES = ["PluralRules", "Locale", "RelativeTimeFormat", "supportedValuesOf"];

// Jest gives each test file its own globals, so nothing here leaks into other files.
describe("polyfills (as on Hermes)", () => {
  beforeAll(() => {
    for (const name of MISSING_ON_HERMES) {
      // Gone, not undefined: the polyfills check `name in Intl`.
      Reflect.deleteProperty(Intl, name);
    }
    jest.isolateModules(() => {
      // A dynamic import() needs Node's experimental VM modules under Jest.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require("./polyfills");
    });
  });

  const AR = getIntlLocale("ar");

  it("installs every missing API", () => {
    for (const name of MISSING_ON_HERMES) {
      expect(Intl[name as keyof typeof Intl]).toBeDefined();
    }
    expect(Intl.supportedValuesOf("timeZone")).toContain("Asia/Hebron");
    expect(new Intl.Locale(AR).language).toBe("ar");
  });

  it("gives Arabic its six plural forms", () => {
    const rules = new Intl.PluralRules(AR);
    expect([0, 1, 2, 3, 11, 100].map((n) => rules.select(n))).toEqual([
      "zero",
      "one",
      "two",
      "few",
      "many",
      "other",
    ]);
  });

  it("renders the shared Arabic messages and formats", () => {
    const t = createTranslator({ locale: AR, messages: ar, formats, timeZone: "Asia/Hebron" });
    expect([0, 1, 2, 3, 11, 100].map((count) => t("classes.studentCount", { count }))).toEqual([
      "لا يوجد طلاب",
      "طالب واحد",
      "طالبان",
      "3 طلاب",
      "11 طالبًا",
      "100 طالب",
    ]);
    const format = createFormatter({ locale: AR, formats, timeZone: "Asia/Hebron" });
    expect(format.dateTime(new Date(Date.UTC(2026, 9, 24)), "lessonDate")).toBe("24 أكتوبر 2026");
    expect(getDirection(AR)).toBe("rtl");
  });
});
