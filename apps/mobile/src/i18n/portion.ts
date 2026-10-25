import { useCallback } from "react";
import { useFormatter, useTranslations } from "use-intl";
import { getSurah, getSurahName } from "@qct/core/domain/quran/surahs";
import { localDateToUtcDate, type LocalDate } from "@qct/core/domain/dates/local-date";
import type { HomeworkRecord } from "@qct/core/shared/schemas/homework";
import { useAppLocale } from "./locale";

/** "النبأ 31–35": the sura's name from the sura map, plus the range (the web's usePortionLabel). */
export function usePortionLabel() {
  const t = useTranslations("evaluation");
  const locale = useAppLocale();
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

/** "2 · البقرة · 286 آية", from the sura map (never free text). */
export function useSurahLabel() {
  const t = useTranslations("quran");
  const locale = useAppLocale();
  return useCallback(
    (number: number) => {
      const surah = getSurah(number);
      if (!surah) return String(number);
      return t("surahOption", {
        number: surah.number,
        name: getSurahName(surah.number, locale) ?? "",
        ayahs: t("ayahs", { count: surah.ayahCount }),
      });
    },
    [t, locale],
  );
}

/** A lesson date as "weekday، day month year" (calendar dates, so in UTC). */
export function useLessonDate() {
  const format = useFormatter();
  const t = useTranslations("lessons");
  return useCallback(
    (date: LocalDate) => {
      const value = localDateToUtcDate(date);
      return t("title", {
        weekday: format.dateTime(value, "weekday"),
        date: format.dateTime(value, "lessonDate"),
      });
    },
    [format, t],
  );
}
