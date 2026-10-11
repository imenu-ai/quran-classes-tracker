"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { ClassStatsView } from "@/components/classes/class-stats-view";
import type { StatsPeriod } from "@/domain/stats/class";

/** A whole number in a range from a query parameter, or null. */
function intParam(value: string | null, min: number, max: number): number | null {
  if (value === null || !/^\d+$/.test(value)) return null;
  const number = Number(value);
  return number >= min && number <= max ? number : null;
}

/**
 * /class-stats?id=…[&year=YYYY[&month=M]] (query params, so one cached
 * shell serves every class offline, and "back" keeps the chosen period).
 */
function ClassStatsContent() {
  const params = useSearchParams();
  const year = intParam(params.get("year"), 2000, 2100);
  const period: StatsPeriod = {
    year,
    month: year === null ? null : intParam(params.get("month"), 1, 12),
  };
  return <ClassStatsView classId={params.get("id")} period={period} />;
}

export default function ClassStatsPage() {
  return (
    <Suspense>
      <ClassStatsContent />
    </Suspense>
  );
}
