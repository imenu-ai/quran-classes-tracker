import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";
import ar from "../../messages/ar.json";
import en from "../../messages/en.json";
import { VALIDATION_CODES } from "@/shared/schemas/errors";
import { getIntlLocale, type Locale } from "./config";
import { translateError, type ErrorsTranslator } from "./error-message";

const translator = (locale: Locale) =>
  createTranslator({
    locale: getIntlLocale(locale),
    messages: locale === "ar" ? ar : en,
    namespace: "errors",
  }) as unknown as ErrorsTranslator;

describe("translateError", () => {
  it("resolves the sura name in the active locale for AYAH_OUT_OF_RANGE", () => {
    const error = { code: "AYAH_OUT_OF_RANGE", params: { surah: 2, ayahCount: 286 } } as const;
    expect(translateError(translator("ar"), error, "ar")).toBe("سورة البقرة تحتوي على 286 آية فقط");
    expect(translateError(translator("en"), error, "en")).toBe("Al-Baqarah has only 286 ayahs");
  });

  it("translates generic validation codes with their params", () => {
    expect(translateError(translator("ar"), { code: "REQUIRED", params: {} }, "ar")).toBe(
      "هذا الحقل مطلوب",
    );
    expect(
      translateError(translator("ar"), { code: "TOO_LARGE", params: { maximum: 10 } }, "ar"),
    ).toBe("يجب ألا تزيد القيمة عن 10");
  });

  it("has a message for every validation code in both locales", () => {
    for (const locale of ["ar", "en"] as const) {
      const t = translator(locale);
      for (const code of VALIDATION_CODES) {
        expect(t.has(`validation.${code}`), `${locale}: ${code}`).toBe(true);
      }
    }
  });

  it("falls back to INVALID for an unknown code", () => {
    const unknown = { code: "SOMETHING_NEW", params: {} } as unknown as Parameters<
      typeof translateError
    >[1];
    expect(translateError(translator("ar"), unknown, "ar")).toBe("القيمة غير صحيحة");
  });
});
