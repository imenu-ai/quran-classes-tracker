"use client";

import { CalendarRange } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useCallback } from "react";
import { EmptyState } from "@/components/empty-state";
import type { MonthStats } from "@/domain/stats/monthly";
import { cn } from "@/lib/utils";

/** Formats "YYYY-MM" as a month name and an average to 1 decimal (or "—"). */
export function useStatsFormat() {
  const format = useFormatter();
  const t = useTranslations("common");
  return {
    month: useCallback(
      (month: string) => format.dateTime(new Date(`${month}-01T00:00:00Z`), "month"),
      [format],
    ),
    average: useCallback(
      (value: number | null) => (value === null ? t("noValue") : format.number(value, "average")),
      [format, t],
    ),
  };
}

/**
 * Per-month summaries, newest first, as a horizontally scrolling row of
 * cards. Tapping a card selects that month for the history below.
 */
export function MonthSummaries({
  months,
  selected,
  onSelect,
}: {
  months: readonly MonthStats[];
  selected: string | null;
  onSelect: (month: string) => void;
}) {
  const t = useTranslations();
  const fmt = useStatsFormat();

  if (months.length === 0) {
    return <EmptyState icon={CalendarRange} title={t("profile.noData")} />;
  }

  return (
    <div
      role="group"
      aria-label={t("profile.selectMonth")}
      className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2"
    >
      {months.map((stats) => {
        const active = stats.month === selected;
        return (
          <button
            key={stats.month}
            type="button"
            aria-pressed={active}
            onClick={() => onSelect(stats.month)}
            className={cn(
              "flex w-60 shrink-0 snap-start flex-col gap-3 rounded-xl border bg-card p-4 text-start transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
              active ? "border-primary ring-1 ring-primary" : "hover:bg-accent/40",
            )}
          >
            <span className="font-semibold">{fmt.month(stats.month)}</span>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
              <div className="flex flex-col">
                <dt className="text-muted-foreground">{t("glossary.monthlyMemorizationRate")}</dt>
                <dd className="text-2xl font-bold tabular-nums">
                  {fmt.average(stats.memorizationAverage)}
                </dd>
              </div>
              <div className="flex flex-col">
                <dt className="text-muted-foreground">{t("glossary.monthlyBehaviorRate")}</dt>
                <dd className="text-2xl font-bold tabular-nums">
                  {fmt.average(stats.behaviorAverage)}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">{t("glossary.attendedDays")}</dt>
                <dd className="font-medium tabular-nums">{stats.present}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">{t("profile.absentDays")}</dt>
                <dd className="font-medium tabular-nums">{stats.absent}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">{t("profile.excusedDays")}</dt>
                <dd className="font-medium tabular-nums">{stats.excused}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">{t("profile.evaluatedItems")}</dt>
                <dd className="font-medium tabular-nums">{stats.evaluatedCount}</dd>
              </div>
            </dl>
          </button>
        );
      })}
    </div>
  );
}
