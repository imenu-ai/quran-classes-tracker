import { useCallback } from "react";
import { useFormatter, useTranslations } from "use-intl";
import { getAyahCount, getSurah, getSurahName } from "@qct/core/domain/quran/surahs";
import { localDateToUtcDate, type LocalDate } from "@qct/core/domain/dates/local-date";
import { pagesOf, portionsOf } from "@qct/core/shared/schemas/homework";
import { useAppLocale } from "./locale";

/**
 * "النبأ 31–35" for one sura, "الملك 1–30، القلم كاملة" for several (the
 * web's usePortionLabel): each sura's name from the sura map, with its range,
 * or "كاملة" when it covers the whole sura. Given as pages, the pages come
 * first: "ص 12–13 · البقرة 77–88".
 */
export function usePortionLabel() {
  const t = useTranslations("evaluation");
  const locale = useAppLocale();
  return useCallback(
    (item: Parameters<typeof portionsOf>[0] & Parameters<typeof pagesOf>[0]) => {
      const portions = portionsOf(item)
        .map((portion) => {
          const surah = getSurahName(portion.surah, locale) ?? String(portion.surah);
          const whole = portion.fromAyah === 1 && portion.toAyah === getAyahCount(portion.surah);
          return whole
            ? t("wholeSurah", { surah })
            : t("range", { surah, from: portion.fromAyah, to: portion.toAyah });
        })
        .join(t("portionSeparator"));
      const pages = pagesOf(item);
      if (!pages) return portions;
      return t("withPages", {
        pages:
          pages.from === pages.to
            ? t("page", { page: pages.from })
            : t("pageRange", { from: pages.from, to: pages.to }),
        portions,
      });
    },
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
