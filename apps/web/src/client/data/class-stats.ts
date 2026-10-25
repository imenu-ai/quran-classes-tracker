import { useLiveQuery } from "dexie-react-hooks";
import { useLocale } from "next-intl";
import { loadClassStatistics, type ClassStatisticsView } from "@qct/core/data/entities/class-stats";
import type { StatsPeriod } from "@qct/core/domain/stats/class";
import { useApp } from "../app-context";

export type { ClassStatisticsView } from "@qct/core/data/entities/class-stats";

/** A class's statistics and student ranking for a period, live from the local database. */
export function useClassStatistics(classId: string | null, period: StatsPeriod) {
  const { db, session } = useApp();
  const locale = useLocale();
  return useLiveQuery(
    async (): Promise<ClassStatisticsView | null> =>
      classId ? loadClassStatistics(db, classId, period, session.timezone, locale) : null,
    [db, classId, period.year, period.month, session.timezone, locale],
  );
}
