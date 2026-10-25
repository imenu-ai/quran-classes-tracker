import { useEffect, useState, type DependencyList } from "react";
import type { LocalDatabase } from "@qct/core/data/database";
import type { LocalTable } from "@qct/core/data/storage";
import { useApp } from "./app-data";

/**
 * The mobile `useLiveQuery`: runs `query` on the local database, and again
 * after every committed write to one of `tables` (all tables when omitted).
 * Returns undefined until the first result. Results from a superseded run
 * are dropped, so a slow read never overwrites a newer one.
 */
export function useLocalQuery<T>(
  query: (db: LocalDatabase) => Promise<T>,
  deps: DependencyList,
  tables?: readonly LocalTable[],
): T | undefined {
  const { db } = useApp();
  const [result, setResult] = useState<{ value: T } | undefined>(undefined);

  useEffect(() => {
    let latest = 0;
    let disposed = false;
    const run = () => {
      const id = ++latest;
      query(db).then(
        (value) => {
          if (!disposed && id === latest) setResult({ value });
        },
        (error: unknown) => {
          if (!disposed) console.error("A local query failed", error);
        },
      );
    };
    const unsubscribe = db.subscribe((changed) => {
      if (!tables || tables.some((table) => changed.has(table))) run();
    });
    run();
    return () => {
      disposed = true;
      unsubscribe();
    };
    // The caller lists what `query` depends on, as with useLiveQuery.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, ...deps]);

  return result?.value;
}
