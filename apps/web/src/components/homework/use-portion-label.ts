"use client";

import { useLocale, useTranslations } from "next-intl";
import { useCallback } from "react";
import { getAyahCount, getSurahName } from "@qct/core/domain/quran/surahs";
import { toAppLocale } from "@qct/core/i18n/config";
import { portionsOf } from "@qct/core/shared/schemas/homework";

/**
 * "النبأ 31–35" for one sura, "الملك 1–30، القلم كاملة" for several: each
 * sura's name from the sura map in the active locale, with its range, or
 * "كاملة" when it covers the whole sura.
 */
export function usePortionLabel() {
  const t = useTranslations("evaluation");
  const locale = toAppLocale(useLocale());
  return useCallback(
    (item: Parameters<typeof portionsOf>[0]) =>
      portionsOf(item)
        .map((portion) => {
          const surah = getSurahName(portion.surah, locale) ?? String(portion.surah);
          const whole = portion.fromAyah === 1 && portion.toAyah === getAyahCount(portion.surah);
          return whole
            ? t("wholeSurah", { surah })
            : t("range", { surah, from: portion.fromAyah, to: portion.toAyah });
        })
        .join(t("portionSeparator")),
    [t, locale],
  );
}
