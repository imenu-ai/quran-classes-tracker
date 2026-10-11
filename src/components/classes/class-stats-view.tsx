"use client";

import { BarChart3, ChevronRight, SearchX, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { useId } from "react";
import { DirectionalIcon } from "@/components/directional-icon";
import { EmptyState } from "@/components/empty-state";
import { PageContainer, PageHeader } from "@/components/shell/page";
import { Skeleton } from "@/components/ui/skeleton";
import { useAccess } from "@/client/access";
import { useClass } from "@/client/data/classes";
import { useClassStatistics } from "@/client/data/class-stats";
import type { StatsPeriod, StudentStanding } from "@/domain/stats/class";
import { cn } from "@/lib/utils";

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

const selectClass =
  "h-12 w-full rounded-lg border border-input bg-background px-3 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 dark:bg-input/30";

/**
 * A class's statistics: its attendance rate and average marks, then its
 * students ranked best first. All time by default, or one year or month.
 */
export function ClassStatsView({
  classId,
  period,
}: {
  classId: string | null;
  period: StatsPeriod;
}) {
  const t = useTranslations("classStats");
  const tCommon = useTranslations("common");
  const format = useFormatter();
  const router = useRouter();
  const ids = { year: useId(), month: useId() };
  const canView = useAccess().can("reports.view");
  const cls = useClass(classId);
  const view = useClassStatistics(classId, period);

  if (!canView) {
    return (
      <PageContainer>
        <PageHeader title={t("title")} backHref={classId ? `/class?id=${classId}` : "/"} />
        <EmptyState icon={ShieldAlert} title={t("notAllowed")} />
      </PageContainer>
    );
  }
  if (cls === undefined || view === undefined) {
    return (
      <PageContainer aria-busy="true">
        <span className="sr-only">{tCommon("loading")}</span>
        <Skeleton className="h-10 w-56" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </PageContainer>
    );
  }
  if (!cls || cls.deletedAt !== null || !view) {
    return (
      <PageContainer>
        <PageHeader title={t("title")} backHref="/" />
        <EmptyState icon={SearchX} title={tCommon("noValue")} />
      </PageContainer>
    );
  }

  const { statistics, students, years } = view;
  // The chosen year is offered even if it has no lessons (e.g. from a link).
  const yearOptions =
    period.year !== null && !years.includes(period.year) ? [period.year, ...years] : years;

  const setPeriod = (next: StatsPeriod) => {
    const params = new URLSearchParams({ id: cls.id });
    if (next.year !== null) params.set("year", String(next.year));
    if (next.year !== null && next.month !== null) params.set("month", String(next.month));
    router.replace(`/class-stats?${params.toString()}`, { scroll: false });
  };

  const percent = (rate: number | null) =>
    rate === null ? tCommon("noValue") : format.number(rate, "percent");
  const average = (value: number | null) =>
    value === null ? tCommon("noValue") : format.number(value, "average");
  const monthName = (month: number) =>
    format.dateTime(new Date(Date.UTC(2026, month - 1, 1)), "monthName");

  return (
    <PageContainer>
      <PageHeader title={t("title")} backHref={`/class?id=${cls.id}`} />
      <p dir="auto" className="-mt-3 text-muted-foreground">
        {cls.name}
      </p>

      <fieldset className="grid grid-cols-2 gap-3">
        <legend className="sr-only">{t("period")}</legend>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={ids.year} className="text-sm font-medium text-muted-foreground">
            {t("year")}
          </label>
          <select
            id={ids.year}
            className={selectClass}
            value={period.year === null ? "" : String(period.year)}
            onChange={(event) =>
              setPeriod({
                year: event.target.value === "" ? null : Number(event.target.value),
                month: null,
              })
            }
          >
            <option value="">{t("allTime")}</option>
            {yearOptions.map((year) => (
              <option key={year} value={String(year)}>
                {year}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={ids.month} className="text-sm font-medium text-muted-foreground">
            {t("month")}
          </label>
          <select
            id={ids.month}
            className={selectClass}
            disabled={period.year === null}
            value={period.month === null ? "" : String(period.month)}
            onChange={(event) =>
              setPeriod({
                year: period.year,
                month: event.target.value === "" ? null : Number(event.target.value),
              })
            }
          >
            <option value="">{t("allMonths")}</option>
            {MONTHS.map((month) => (
              <option key={month} value={String(month)}>
                {monthName(month)}
              </option>
            ))}
          </select>
        </div>
      </fieldset>

      {statistics.lessonDays === 0 ? (
        <EmptyState icon={BarChart3} title={t("noLessons")} />
      ) : (
        <>
          <section
            aria-label={t("title")}
            className="grid grid-cols-2 gap-3 rounded-2xl border bg-card p-4 shadow-sm"
          >
            <div className="col-span-2 flex flex-col gap-1">
              <span className="text-sm text-muted-foreground">{t("attendanceRate")}</span>
              <span className="text-4xl font-bold text-primary tabular-nums">
                {percent(statistics.rate)}
              </span>
              <span className="text-sm text-muted-foreground tabular-nums">
                {t("attendanceCounts", {
                  present: statistics.present,
                  absent: statistics.absent,
                  excused: statistics.excused,
                })}
              </span>
            </div>
            <div className="flex flex-col gap-1 border-t pt-3">
              <span className="text-sm text-muted-foreground">{t("memorizationAverage")}</span>
              <span className="text-2xl font-semibold tabular-nums">
                {average(statistics.memorizationAverage)}
              </span>
            </div>
            <div className="flex flex-col gap-1 border-t pt-3">
              <span className="text-sm text-muted-foreground">{t("behaviorAverage")}</span>
              <span className="text-2xl font-semibold tabular-nums">
                {average(statistics.behaviorAverage)}
              </span>
            </div>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-lg font-semibold">{t("ranking")}</h2>
            <p className="text-sm text-muted-foreground">{t("rankingHint")}</p>
            <ol className="flex flex-col gap-2">
              {statistics.students.map((standing, index) => (
                <li key={standing.studentId}>
                  <RankedStudent
                    rank={index + 1}
                    name={students.get(standing.studentId)?.fullName ?? ""}
                    standing={standing}
                    percent={percent}
                    average={average}
                  />
                </li>
              ))}
            </ol>
          </section>
        </>
      )}
    </PageContainer>
  );
}

function RankedStudent({
  rank,
  name,
  standing,
  percent,
  average,
}: {
  rank: number;
  name: string;
  standing: StudentStanding;
  percent: (rate: number | null) => string;
  average: (value: number | null) => string;
}) {
  const t = useTranslations("classStats");
  return (
    <Link
      href={`/student?id=${standing.studentId}`}
      className="group flex min-h-16 items-center gap-3 rounded-xl border bg-card p-3 hover:bg-accent/40 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      <span
        aria-label={t("rank", { rank })}
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-base font-bold tabular-nums",
          rank <= 3 && "bg-primary text-primary-foreground",
        )}
      >
        {rank}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span dir="auto" className="truncate text-base font-semibold">
          {name}
        </span>
        <span className="text-sm text-muted-foreground tabular-nums">
          {t("studentAttendance", { attended: standing.attended, possible: standing.possible })}
          {" · "}
          {percent(standing.rate)}
        </span>
      </span>
      <span className="flex shrink-0 gap-3 text-center">
        <span className="flex w-10 flex-col">
          <span className="text-xs text-muted-foreground">{t("memorizationShort")}</span>
          <span className="font-semibold tabular-nums">
            {average(standing.memorizationAverage)}
          </span>
        </span>
        <span className="flex w-10 flex-col">
          <span className="text-xs text-muted-foreground">{t("behaviorShort")}</span>
          <span className="font-semibold tabular-nums">{average(standing.behaviorAverage)}</span>
        </span>
      </span>
      <DirectionalIcon
        icon={ChevronRight}
        className="size-5 shrink-0 text-muted-foreground group-hover:text-foreground"
      />
    </Link>
  );
}
