"use client";

import { useFormatter, useLocale, useTranslations } from "next-intl";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import type { MonthStats } from "@/domain/stats/monthly";
import { getDirection } from "@/i18n/direction";
import { useStatsFormat } from "./month-summaries";

/** At most this many months (the most recent ones that have data). */
const MONTHS_SHOWN = 12;

/**
 * Monthly memorization and behavior averages over time. In RTL the time
 * axis runs right-to-left and the value axis sits on the right. Screen
 * readers get the same numbers as a table instead of the SVG.
 */
export function MonthlyChart({ months }: { months: readonly MonthStats[] }) {
  const t = useTranslations();
  const format = useFormatter();
  const fmt = useStatsFormat();
  const rtl = getDirection(useLocale()) === "rtl";

  // `months` is newest first; the chart reads oldest → newest.
  const recent = months.slice(0, MONTHS_SHOWN).reverse();
  const data = recent.map((stats) => ({
    month: stats.month,
    memorization: stats.memorizationAverage,
    behavior: stats.behaviorAverage,
  }));
  const hasScores = data.some((d) => d.memorization !== null || d.behavior !== null);
  if (!hasScores) return null;

  const config = {
    memorization: { label: t("glossary.memorizationRate"), color: "var(--chart-1)" },
    behavior: { label: t("glossary.behaviorRate"), color: "var(--chart-2)" },
  } satisfies ChartConfig;
  const shortMonth = (month: string) =>
    format.dateTime(new Date(`${month}-01T00:00:00Z`), "monthShort");

  return (
    <section className="flex flex-col gap-2 rounded-xl border bg-card p-4">
      <h2 className="font-semibold">{t("profile.chartTitle")}</h2>
      {/* Clipped: Recharts' absolutely positioned tooltip must not widen the page. */}
      <div aria-hidden className="overflow-hidden">
        <ChartContainer config={config} className="aspect-auto h-56 w-full">
          <LineChart data={data} margin={{ top: 8, bottom: 0, left: 4, right: 4 }}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="month"
              reversed={rtl}
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={shortMonth}
            />
            <YAxis
              orientation={rtl ? "right" : "left"}
              domain={[0, 10]}
              ticks={[0, 2, 4, 6, 8, 10]}
              width={28}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value: number) => format.number(value)}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  labelFormatter={(_, payload) =>
                    fmt.month(String(payload?.[0]?.payload?.month ?? ""))
                  }
                />
              }
            />
            <ChartLegend content={<ChartLegendContent />} />
            {(["memorization", "behavior"] as const).map((key) => (
              <Line
                key={key}
                dataKey={key}
                type="monotone"
                stroke={`var(--color-${key})`}
                strokeWidth={2.5}
                dot={{ r: 4 }}
                connectNulls
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ChartContainer>
      </div>

      {/* sr-only on a wrapper: a <table> ignores the 1px width and would widen the page. */}
      <div className="sr-only">
        <table>
          <caption>{t("profile.chartTable")}</caption>
          <thead>
            <tr>
              <th scope="col">{t("profile.month")}</th>
              <th scope="col">{t("glossary.monthlyMemorizationRate")}</th>
              <th scope="col">{t("glossary.monthlyBehaviorRate")}</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr key={row.month}>
                <th scope="row">{fmt.month(row.month)}</th>
                <td>{fmt.average(row.memorization)}</td>
                <td>{fmt.average(row.behavior)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
