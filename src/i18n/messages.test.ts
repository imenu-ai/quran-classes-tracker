import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";
import ar from "../../messages/ar.json";
import en from "../../messages/en.json";
import { AYAH_RANGE_ERROR_CODES } from "@/domain/quran/validation";
import { getSurahName } from "@/domain/quran/surahs";
import { getIntlLocale } from "./config";

type MessageTree = { [key: string]: string | MessageTree };

function flattenKeys(tree: MessageTree, prefix = ""): string[] {
  return Object.entries(tree).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof value === "string" ? [path] : flattenKeys(value, path);
  });
}

function getValue(tree: MessageTree, path: string): string | MessageTree | undefined {
  return path.split(".").reduce<string | MessageTree | undefined>((node, key) => {
    return typeof node === "object" ? node[key] : undefined;
  }, tree);
}

describe("message files", () => {
  const arKeys = flattenKeys(ar).sort();
  const enKeys = flattenKeys(en).sort();

  it("ar.json and en.json have exactly the same keys", () => {
    expect(enKeys).toEqual(arKeys);
  });

  it("has no empty messages", () => {
    for (const key of arKeys) {
      expect(String(getValue(ar, key)).trim(), `ar: ${key}`).not.toBe("");
      expect(String(getValue(en, key)).trim(), `en: ${key}`).not.toBe("");
    }
  });

  it("has a message for every ayah range error code", () => {
    for (const code of AYAH_RANGE_ERROR_CODES) {
      expect(arKeys).toContain(`errors.ayahRange.${code}`);
    }
  });
});

describe("Arabic messages from the brief", () => {
  const t = createTranslator({ locale: getIntlLocale("ar"), messages: ar });

  it("formats the ayah range errors", () => {
    expect(t("errors.ayahRange.SURAH_NOT_FOUND")).toBe("السورة غير موجودة");
    expect(t("errors.ayahRange.INVALID_AYAH")).toBe("رقم الآية غير صحيح");
    expect(t("errors.ayahRange.FROM_AFTER_TO")).toBe(
      "آية البداية يجب أن تكون قبل أو تساوي آية النهاية",
    );
    expect(
      t("errors.ayahRange.AYAH_OUT_OF_RANGE", {
        surahName: getSurahName(2, "ar")!,
        ayahCount: 286,
      }),
    ).toBe("سورة البقرة تحتوي على 286 آية فقط");
    expect(
      t("errors.ayahRange.AYAH_OUT_OF_RANGE", {
        surahName: getSurahName(108, "ar")!,
        ayahCount: 3,
      }),
    ).toBe("سورة الكوثر تحتوي على 3 آيات فقط");
  });

  it("formats a sura picker option with Western digits", () => {
    const ayahs = t("quran.ayahs", { count: 286 });
    expect(t("quran.surahOption", { number: 2, name: "البقرة", ayahs })).toBe(
      "2 · البقرة · 286 آية",
    );
  });
});
