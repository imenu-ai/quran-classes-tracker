"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useCallback } from "react";
import { localDateToUtcDate, type LocalDate } from "@/domain/dates/local-date";

/** Formats a lesson date as "weekday, day month year" in the active locale. */
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
