import { useLiveQuery } from "dexie-react-hooks";
import { useLocale } from "next-intl";
import { loadActiveClasses, loadClass, loadClassList } from "@qct/core/data/entities/classes";
import { useApp } from "../app-context";

export * from "@qct/core/data/entities/classes";

/** Home screen data: active class summaries and archived classes. */
export function useClassList() {
  const { db } = useApp();
  const locale = useLocale();
  return useLiveQuery(() => loadClassList(db, locale), [db, locale]);
}

/** Every active class (for "move to" pickers). */
export function useActiveClasses() {
  const { db } = useApp();
  const locale = useLocale();
  return useLiveQuery(() => loadActiveClasses(db, locale), [db, locale]);
}

export function useClass(id: string | null) {
  const { db } = useApp();
  // null = not found, undefined = still loading.
  return useLiveQuery(async () => (id ? loadClass(db, id) : null), [db, id]);
}
