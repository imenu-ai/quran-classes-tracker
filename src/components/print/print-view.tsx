"use client";

import { ArrowLeft, Printer, SearchX, ShieldAlert, UsersRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { DirectionalIcon } from "@/components/directional-icon";
import { EmptyState } from "@/components/empty-state";
import { PageContainer, PageHeader } from "@/components/shell/page";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAccess } from "@/client/access";
import { useApp } from "@/client/app-context";
import { usePrintSheets } from "@/client/data/print";
import { todayInTimeZone } from "@/domain/dates/local-date";
import { MonthSheet } from "./month-sheet";

/** An A4 sheet's width in CSS pixels (210 mm at 96 dpi). */
const SHEET_WIDTH_PX = (210 / 25.4) * 96;

/**
 * The preview fits whole sheets to the screen width (paper keeps its real
 * size: print CSS resets the zoom).
 */
function useFitZoom() {
  // A callback ref: the preview only mounts once the data has loaded.
  const [element, setElement] = useState<HTMLDivElement | null>(null);
  const [zoom, setZoom] = useState(1);
  useEffect(() => {
    if (!element) return;
    // The container's side padding (p-4) isn't room for the sheet.
    const update = () => setZoom(Math.min(1, (element.clientWidth - 32) / SHEET_WIDTH_PX));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [element]);
  return { ref: setElement, zoom };
}

/**
 * Month sheets ready to print: a toolbar (back, "print / save PDF") and an
 * A4 page per student. The device's print dialog prints them or saves a PDF.
 */
export function PrintView({
  classId,
  month,
  studentIds,
}: {
  classId: string | null;
  month: string | null;
  studentIds: readonly string[];
}) {
  const t = useTranslations();
  const format = useFormatter();
  const router = useRouter();
  const { session } = useApp();
  const canView = useAccess().can("reports.view");
  const data = usePrintSheets(classId, studentIds, month);
  const { ref, zoom } = useFitZoom();
  const classHref = classId ? `/class?id=${classId}` : "/";

  // The browser suggests the document title as the PDF's file name.
  const monthLabel = month ? format.dateTime(new Date(`${month}-01T00:00:00Z`), "month") : "";
  const sheets = data?.sheets ?? [];
  const documentTitle =
    sheets.length === 1
      ? `${t("print.title")} - ${sheets[0]!.student.fullName} - ${monthLabel}`
      : data
        ? `${t("print.title")} - ${data.cls.name} - ${monthLabel}`
        : null;
  useEffect(() => {
    if (!documentTitle) return;
    const previous = document.title;
    document.title = documentTitle;
    return () => {
      document.title = previous;
    };
  }, [documentTitle]);

  if (!canView) {
    return (
      <PageContainer>
        <PageHeader title={t("print.pageTitle")} backHref={classHref} />
        <EmptyState icon={ShieldAlert} title={t("classStats.notAllowed")} />
      </PageContainer>
    );
  }
  if (data === undefined) {
    return (
      <PageContainer aria-busy="true">
        <span className="sr-only">{t("common.loading")}</span>
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-96 w-full" />
      </PageContainer>
    );
  }
  if (data === null || sheets.length === 0) {
    return (
      <PageContainer>
        <PageHeader title={t("print.pageTitle")} backHref={classHref} />
        <EmptyState
          icon={data === null ? SearchX : UsersRound}
          title={data === null ? t("common.noValue") : t("print.noStudents")}
        />
      </PageContainer>
    );
  }

  const back = () => (window.history.length > 1 ? router.back() : router.push(classHref));
  const printedOn = todayInTimeZone(session.timezone);

  return (
    <div className="min-h-dvh bg-muted/60 print:min-h-0 print:bg-white">
      <div className="sticky top-0 z-10 border-b bg-background/95 pt-[env(safe-area-inset-top)] backdrop-blur print:hidden">
        <div className="mx-auto flex max-w-4xl items-center gap-2 px-4 py-2">
          <Button
            variant="ghost"
            size="icon"
            className="-ms-2 size-11"
            aria-label={t("nav.back")}
            onClick={back}
          >
            <DirectionalIcon icon={ArrowLeft} className="size-5" />
          </Button>
          <div className="flex min-w-0 flex-1 flex-col">
            <h1 className="truncate text-lg font-bold">{t("print.pageTitle")}</h1>
            <p className="text-sm text-muted-foreground">
              {t("print.sheetCount", { count: sheets.length })} · {monthLabel}
            </p>
          </div>
          <Button className="h-11" onClick={() => window.print()}>
            <Printer aria-hidden />
            {t("print.printButton")}
          </Button>
        </div>
        <p className="mx-auto max-w-4xl px-4 pb-2 text-xs text-muted-foreground">
          {t("print.hint")}
        </p>
      </div>

      <div ref={ref} className="mx-auto flex max-w-4xl flex-col gap-4 p-4 print:block print:p-0">
        {sheets.map((sheet) => (
          <div
            key={sheet.student.id}
            className="print-page mx-auto shadow-lg print:shadow-none"
            style={{ zoom }}
          >
            <MonthSheet
              sheet={sheet}
              centerName={session.tenantName}
              className={data.cls.name}
              userName={session.name}
              month={month!}
              printedOn={printedOn}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
