import { useLiveQuery } from "dexie-react-hooks";
import { loadPrintSheets } from "@qct/core/data/entities/print";
import { useApp } from "../app-context";

export { loadPrintSheets, type PrintSheets } from "@qct/core/data/entities/print";
export {
  buildMonthSheet,
  type MonthSheet,
  type MonthSheetCounts,
} from "@qct/core/domain/stats/month-sheet";

/** The print page for some of a class's students and a month ("YYYY-MM"). */
export function printHref(classId: string, month: string, studentIds: readonly string[]) {
  const params = new URLSearchParams({ class: classId, month, students: studentIds.join(",") });
  return `/print?${params.toString()}`;
}

/** The print page's data, live from the local database. */
export function usePrintSheets(
  classId: string | null,
  studentIds: readonly string[],
  month: string | null,
) {
  const { db } = useApp();
  const key = studentIds.join(",");
  return useLiveQuery(
    async () => (classId && month ? loadPrintSheets(db, classId, studentIds, month) : null),
    // The ids by value, so a new array with the same ids doesn't reload.
    [db, classId, key, month],
  );
}
