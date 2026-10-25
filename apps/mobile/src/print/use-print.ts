import { useCallback } from "react";
import { File } from "expo-file-system";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { useFormatter, useTranslations } from "use-intl";
import { loadPrintSheets } from "@qct/core/data/entities/print";
import { localDateToUtcDate, todayInTimeZone } from "@qct/core/domain/dates/local-date";
import { parentLink } from "@qct/core/shared/parent";
import { API_URL } from "@/config";
import { useApp } from "@/data/app-data";
import { usePortionLabel } from "@/i18n/portion";
import { embeddedFontCss } from "./fonts";
import { buildSheetsHtml, type SheetText } from "./month-sheet-html";

/** Print through the system dialog, or save a PDF and open the share sheet. */
export type PrintMode = "print" | "share";

/**
 * The PDF under a name people recognise ("أحمد علي 2026-10.pdf") instead of
 * expo-print's random one; the original file if renaming fails.
 */
async function withName(uri: string, name: string): Promise<string> {
  try {
    const source = new File(uri);
    // Characters file systems refuse.
    const target = new File(source.parentDirectory, name.replace(/[\\/:*?"<>|]/g, "-"));
    await source.move(target, { overwrite: true });
    return target.uri;
  } catch {
    return uri;
  }
}

/** A4 in PostScript points, for the PDF. */
const A4 = { width: 595, height: 842 };

/**
 * Prints some of a class's students' month sheets ("YYYY-MM") from the local
 * data, as the web's /print page does, through expo-print. Resolves false
 * when there was nothing to print.
 */
export function usePrintSheets() {
  const t = useTranslations();
  const format = useFormatter();
  const portion = usePortionLabel();
  const { db, session } = useApp();

  return useCallback(
    async (classId: string, studentIds: readonly string[], month: string, mode: PrintMode) => {
      const data = await loadPrintSheets(db, classId, studentIds, month);
      if (!data || data.sheets.length === 0) return false;
      const text: SheetText = {
        t: t as unknown as SheetText["t"],
        day: (date) => format.dateTime(localDateToUtcDate(date), "dayShort"),
        month: (key) => format.dateTime(new Date(`${key}-01T00:00:00Z`), "month"),
        date: (date) => format.dateTime(localDateToUtcDate(date), "lessonDate"),
        average: (value) =>
          value === null ? t("common.noValue") : format.number(value, "average"),
        portion,
      };
      const html = buildSheetsHtml({
        sheets: data.sheets,
        centerName: session.tenantName,
        className: data.cls.name,
        userName: session.name,
        month,
        printedOn: todayInTimeZone(session.timezone),
        // The parent page is on the web, where the app's server is.
        parentUrl: (studentId) => parentLink(API_URL, studentId),
        fontCss: await embeddedFontCss(),
        text,
      });
      if (mode === "print") {
        await Print.printAsync({ html, ...A4 });
      } else {
        const { uri } = await Print.printToFileAsync({ html, ...A4 });
        const name = data.sheets.length === 1 ? data.sheets[0]!.student.fullName : data.cls.name;
        await Sharing.shareAsync(await withName(uri, `${name} ${month}.pdf`), {
          mimeType: "application/pdf",
          UTI: "com.adobe.pdf",
          dialogTitle: t("print.title"),
        });
      }
      return true;
    },
    [db, session, t, format, portion],
  );
}
