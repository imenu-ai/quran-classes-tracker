"use client";

import { Clock } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useId } from "react";
import { usePortionLabel } from "@/components/homework/use-portion-label";
import { Badge } from "@/components/ui/badge";
import { localDateToUtcDate } from "@qct/core/domain/dates/local-date";
import { nativeSelectClass } from "@/lib/native-select";
import { cn } from "@/lib/utils";
import type { ParentReport as ParentReportData, ParentRow } from "@qct/core/shared/parent";

/**
 * A student's month for his parent (read-only): the month picker, the
 * averages and counts, then each day's homework, exam, postponement or
 * absence with its marks.
 */
export function ParentReport({
  report,
  onMonthChange,
}: {
  report: ParentReportData;
  onMonthChange: (month: string) => void;
}) {
  const t = useTranslations();
  const format = useFormatter();
  const label = usePortionLabel();
  const monthId = useId();

  const monthLabel = (key: string) => format.dateTime(new Date(`${key}-01T00:00:00Z`), "month");
  const day = (date: string) => format.dateTime(localDateToUtcDate(date), "dayShort");
  const average = (value: number | null) =>
    value === null ? t("common.noValue") : format.number(value, "average");
  const score = (value: number | null) => (value === null ? t("common.noValue") : String(value));
  const portion = (row: ParentRow) =>
    row.surah === null || row.fromAyah === null || row.toAyah === null
      ? ""
      : label({ surah: row.surah, fromAyah: row.fromAyah, toAyah: row.toAyah });
  const counts: [string, number][] = [
    [t("print.present"), report.counts.present],
    [t("print.absent"), report.counts.absent],
    [t("print.excused"), report.counts.excused],
    [t("print.evaluated"), report.counts.evaluated],
    [t("print.exams"), report.counts.exams],
    [t("print.postponed"), report.counts.postponed],
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor={monthId} className="text-sm font-medium text-muted-foreground">
          {t("print.month")}
        </label>
        <select
          id={monthId}
          className={nativeSelectClass}
          value={report.month}
          onChange={(event) => onMonthChange(event.target.value)}
        >
          {report.months.map((key) => (
            <option key={key} value={key}>
              {monthLabel(key)}
            </option>
          ))}
        </select>
      </div>

      <section
        aria-label={t("profile.average")}
        className="grid grid-cols-2 gap-3 rounded-2xl border bg-card p-4 shadow-sm"
      >
        <div className="flex flex-col gap-1">
          <span className="text-sm text-muted-foreground">{t("glossary.memorizationRate")}</span>
          <span className="text-3xl font-bold text-primary tabular-nums">
            {average(report.memorizationAverage)}
          </span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-sm text-muted-foreground">{t("glossary.behaviorRate")}</span>
          <span className="text-3xl font-bold text-primary tabular-nums">
            {average(report.behaviorAverage)}
          </span>
        </div>
        <dl className="col-span-2 grid grid-cols-3 gap-2 border-t pt-3">
          {counts.map(([name, value]) => (
            <div key={name} className="flex flex-col items-center gap-0.5 text-center">
              <dt className="text-xs leading-tight text-muted-foreground">{name}</dt>
              <dd className="text-lg font-semibold tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="overflow-hidden rounded-xl border bg-card">
        <table className="w-full table-fixed border-collapse text-sm">
          <caption className="sr-only">
            {t("profile.tableCaption", { month: monthLabel(report.month) })}
          </caption>
          <colgroup>
            <col className="w-[4.5rem]" />
            <col />
            <col className="w-14" />
            <col className="w-14" />
          </colgroup>
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              <th scope="col" className="px-2 py-2 text-start font-medium">
                {t("profile.dateHeader")}
              </th>
              <th scope="col" className="px-2 py-2 text-start font-medium">
                {t("glossary.homework")}
              </th>
              <th scope="col" className="px-1 py-2 text-center font-medium">
                {t("profile.memorizationShort")}
              </th>
              <th scope="col" className="px-1 py-2 text-center font-medium">
                {t("profile.behaviorShort")}
              </th>
            </tr>
          </thead>
          <tbody>
            {report.rows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">
                  {t("profile.noHistory")}
                </td>
              </tr>
            )}
            {report.rows.map((row, index) => (
              <tr
                key={`${row.date}:${row.kind}:${index}`}
                className={cn("border-t align-top", row.kind === "exam" && "bg-exam/10")}
              >
                <td className="px-2 py-2.5 font-medium tabular-nums">{day(row.date)}</td>
                {row.kind === "absent" || row.kind === "excused" ? (
                  <td colSpan={3} className="px-2 py-2.5">
                    <span className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant={row.kind === "absent" ? "destructive" : "secondary"}
                        className={cn(
                          row.kind === "excused" && "bg-warning text-warning-foreground",
                        )}
                      >
                        {t(`glossary.${row.kind}`)}
                      </Badge>
                      {row.excuseNote && (
                        <span dir="auto" className="text-muted-foreground">
                          {row.excuseNote}
                        </span>
                      )}
                    </span>
                  </td>
                ) : (
                  <>
                    <td className="px-2 py-2.5">
                      <span className="flex flex-wrap items-center gap-1.5">
                        <bdi className="break-words">{portion(row)}</bdi>
                        {row.kind === "exam" && (
                          <Badge className="bg-exam text-exam-foreground">{t("exam.badge")}</Badge>
                        )}
                      </span>
                    </td>
                    {row.kind === "exam" ? (
                      <td
                        colSpan={2}
                        className="px-1 py-2.5 text-center font-semibold text-exam tabular-nums"
                      >
                        {score(row.memorization)}
                      </td>
                    ) : row.kind === "postponed" ? (
                      <td colSpan={2} className="px-1 py-2.5 text-center">
                        <Badge className="bg-warning text-warning-foreground">
                          <Clock aria-hidden />
                          {t("today.postponed")}
                        </Badge>
                      </td>
                    ) : (
                      <>
                        <td className="px-1 py-2.5 text-center font-semibold tabular-nums">
                          {score(row.memorization)}
                        </td>
                        <td className="px-1 py-2.5 text-center font-semibold tabular-nums">
                          {score(row.behavior)}
                        </td>
                      </>
                    )}
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
