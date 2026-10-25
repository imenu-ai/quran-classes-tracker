import { useLiveQuery } from "dexie-react-hooks";
import { useLocale } from "next-intl";
import { loadStudentSearch } from "@qct/core/data/entities/search";
import { useApp } from "../app-context";

export * from "@qct/core/data/entities/search";

export function useStudentSearch(query: string) {
  const { db } = useApp();
  const locale = useLocale();
  return useLiveQuery(() => loadStudentSearch(db, query, locale), [db, query, locale]);
}
