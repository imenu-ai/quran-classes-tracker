"use client";

import { useLocale, useTranslations } from "next-intl";
import { useCallback } from "react";
import { getSurahName } from "@/domain/quran/surahs";
import { toAppLocale } from "@/i18n/config";
import type { HomeworkRecord } from "@/shared/schemas/homework";

/** "النبأ 31–35": sura name from the sura map in the active locale, plus the range. */
export function usePortionLabel() {
  const t = useTranslations("evaluation");
  const locale = toAppLocale(useLocale());
  return useCallback(
    (item: Pick<HomeworkRecord, "surah" | "fromAyah" | "toAyah">) =>
      t("range", {
        surah: getSurahName(item.surah, locale) ?? String(item.surah),
        from: item.fromAyah,
        to: item.toAyah,
      }),
    [t, locale],
  );
}
