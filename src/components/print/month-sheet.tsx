"use client";

import { useFormatter, useTranslations } from "next-intl";
import { usePortionLabel } from "@/components/homework/use-portion-label";
import type { MonthSheet as MonthSheetData } from "@/client/data/print";
import { localDateToUtcDate } from "@/domain/dates/local-date";
import { cn } from "@/lib/utils";
import { isExam } from "@/shared/schemas/homework";

/**
 * Smaller text and tighter rows for longer months, so a month stays on one
 * page. The limits leave room for the smallest likely paper: iOS prints on
 * its own paper (US Letter in some regions) with its own margins, about
 * 250 mm of height. Up to 24 rows as is, up to 34 dense, then denser (fits
 * about 43). A longer month continues on a second page, its header repeated.
 */
function densityOf(rows: number) {
  return rows > 34 ? "denser" : rows > 24 ? "dense" : "normal";
}

const DENSITY = {
  normal: { sheet: "gap-3 text-[10pt]", cell: "py-0.5" },
  dense: { sheet: "gap-2 text-[8.5pt] leading-snug", cell: "py-px" },
  denser: { sheet: "gap-1.5 text-[7.5pt] leading-tight", cell: "py-px" },
} as const;

/**
 * One student's month on an A4 sheet: who and when at the top, the month
 * table (oldest day first) with its averages, then the month's counts.
 * Fixed light colours (not theme tokens): paper is white in dark mode too.
 */
export function MonthSheet({
  sheet,
  centerName,
  className,
  userName,
  month,
  printedOn,
}: {
  sheet: MonthSheetData;
  centerName: string;
  className: string;
  userName: string;
  /** "YYYY-MM". */
  month: string;
  /** Today, "YYYY-MM-DD" in the center's time zone. */
  printedOn: string;
}) {
  const t = useTranslations();
  const format = useFormatter();
  const label = usePortionLabel();
  const density = DENSITY[densityOf(sheet.rows.length)];

  const day = (date: string) => format.dateTime(localDateToUtcDate(date), "dayShort");
  const average = (value: number | null) =>
    value === null ? t("common.noValue") : format.number(value, "average");
  const score = (value: number | null) => (value === null ? t("common.noValue") : String(value));
  const counts: [string, number][] = [
    [t("print.present"), sheet.counts.present],
    [t("print.absent"), sheet.counts.absent],
    [t("print.excused"), sheet.counts.excused],
    [t("print.evaluated"), sheet.counts.evaluated],
    [t("print.exams"), sheet.counts.exams],
    [t("print.postponed"), sheet.counts.postponed],
  ];

  return (
    <article className={cn("print-sheet flex flex-col bg-white text-neutral-900", density.sheet)}>
      <header className="flex flex-col border-b-2 border-neutral-800 pb-1.5">
        <p dir="auto" className="text-[15pt] leading-tight font-bold">
          {centerName}
        </p>
        <p className="text-[10.5pt] text-neutral-600">{t("print.title")}</p>
      </header>

      <dl className="grid grid-cols-2 gap-x-6 gap-y-0.5">
        <div className="flex gap-2">
          <dt className="text-neutral-600">{t("print.student")}:</dt>
          <dd dir="auto" className="text-[12pt] leading-tight font-bold">
            {sheet.student.fullName}
          </dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-neutral-600">{t("print.month")}:</dt>
          <dd className="font-semibold">
            {format.dateTime(new Date(`${month}-01T00:00:00Z`), "month")}
          </dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-neutral-600">{t("print.class")}:</dt>
          <dd dir="auto" className="font-semibold">
            {className}
          </dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-neutral-600">{t("print.preparedBy")}:</dt>
          <dd dir="auto" className="font-semibold">
            {userName}
          </dd>
        </div>
      </dl>

      <table className="w-full table-fixed border-collapse">
        <colgroup>
          <col className="w-[24mm]" />
          <col />
          <col className="w-[18mm]" />
          <col className="w-[18mm]" />
        </colgroup>
        <thead className="bg-neutral-100">
          <tr>
            <th scope="col" className="border border-neutral-400 px-2 py-1 text-start">
              {t("profile.dateHeader")}
            </th>
            <th scope="col" className="border border-neutral-400 px-2 py-1 text-start">
              {t("glossary.homework")}
            </th>
            <th scope="col" className="border border-neutral-400 px-1 py-1 text-center">
              {t("profile.memorizationShort")}
            </th>
            <th scope="col" className="border border-neutral-400 px-1 py-1 text-center">
              {t("profile.behaviorShort")}
            </th>
          </tr>
        </thead>
        <tbody>
          {sheet.rows.length === 0 && (
            <tr>
              <td colSpan={4} className="border border-neutral-400 px-2 py-4 text-center">
                {t("profile.noHistory")}
              </td>
            </tr>
          )}
          {sheet.rows.map((row) => {
            const cell = cn("border border-neutral-400 px-2", density.cell);
            const exam = row.kind === "evaluation" && isExam(row.item);
            return (
              <tr
                key={`${row.kind}:${row.kind === "absence" ? row.record.id : row.item.id}:${row.lesson.id}`}
                className={cn(
                  "break-inside-avoid",
                  exam && "bg-violet-50",
                  row.kind === "absence" && "bg-neutral-50",
                )}
              >
                <td className={cn(cell, "tabular-nums")}>{day(row.lesson.date)}</td>
                {row.kind === "absence" ? (
                  <td colSpan={3} className={cell}>
                    <span className="font-semibold">{t(`glossary.${row.record.status}`)}</span>
                    {row.record.excuseNote && (
                      <span dir="auto" className="text-neutral-600">
                        {" "}
                        · {row.record.excuseNote}
                      </span>
                    )}
                  </td>
                ) : (
                  <>
                    <td className={cell}>
                      <bdi>{label(row.item)}</bdi>
                      {exam && (
                        <span className="ms-2 rounded border border-violet-700 px-1.5 text-[0.85em] font-semibold text-violet-800">
                          {t("exam.badge")}
                        </span>
                      )}
                    </td>
                    {exam ? (
                      <td
                        colSpan={2}
                        className={cn(
                          cell,
                          "text-center font-semibold text-violet-800 tabular-nums",
                        )}
                      >
                        {score(row.item.memorizationRate)}
                      </td>
                    ) : row.kind === "postponed" ? (
                      <td colSpan={2} className={cn(cell, "text-center")}>
                        {t("today.postponed")}
                      </td>
                    ) : (
                      <>
                        <td className={cn(cell, "text-center font-semibold tabular-nums")}>
                          {score(row.item.memorizationRate)}
                        </td>
                        <td className={cn(cell, "text-center font-semibold tabular-nums")}>
                          {score(row.item.behaviorRate)}
                        </td>
                      </>
                    )}
                  </>
                )}
              </tr>
            );
          })}
        </tbody>
        <tfoot className="bg-neutral-100 font-bold">
          <tr>
            <th scope="row" colSpan={2} className="border border-neutral-400 px-2 py-1 text-start">
              {t("profile.average")}
            </th>
            <td className="border border-neutral-400 px-1 py-1 text-center tabular-nums">
              {average(sheet.memorizationAverage)}
            </td>
            <td className="border border-neutral-400 px-1 py-1 text-center tabular-nums">
              {average(sheet.behaviorAverage)}
            </td>
          </tr>
        </tfoot>
      </table>

      {/* One row of six, to leave the page to the table. */}
      <dl className="grid grid-cols-6 gap-1.5">
        {counts.map(([name, value]) => (
          <div
            key={name}
            className="flex flex-col items-center rounded border border-neutral-400 px-1 py-0.5 text-center"
          >
            <dt className="text-[0.85em] leading-tight text-neutral-600">{name}</dt>
            <dd className="text-[1.15em] leading-tight font-bold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>

      <footer className="mt-auto flex justify-between border-t border-neutral-300 pt-1 text-[8pt] text-neutral-500">
        <span>{t("app.name")}</span>
        <span>
          {t("print.printedOn")}: {format.dateTime(localDateToUtcDate(printedOn), "lessonDate")}
        </span>
      </footer>
    </article>
  );
}
