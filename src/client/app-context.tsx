"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useRouter } from "next/navigation";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import { openLocalDb, type LocalDb } from "./db/dexie";
import { LocalStore } from "./db/local-store";
import { getDeviceId, readSession, type SessionSnapshot } from "./session/session";
import { SyncEngine, type SyncStatus } from "./sync/engine";
import { requestPersistentStorage } from "./pwa/install";
import { warmPageCache } from "./pwa/page-cache";
import { attachSyncTriggers } from "./sync/triggers";

export interface AppServices {
  session: SessionSnapshot;
  db: LocalDb;
  store: LocalStore;
  engine: SyncEngine;
}

const AppContext = createContext<AppServices | null>(null);

/** The signed-in teacher's local database, store and sync engine. */
export function useApp(): AppServices {
  const services = useContext(AppContext);
  if (!services) throw new Error("useApp must be used inside <AppProvider>");
  return services;
}

export function useSyncStatus(): SyncStatus {
  const { engine } = useApp();
  return useSyncExternalStore(
    (onChange) => engine.subscribe(onChange),
    () => engine.getStatus(),
    () => engine.getStatus(),
  );
}

/**
 * Client-side gate for the app (pages are not gated on the server so the
 * cached shell works offline). With a saved session it opens that teacher's
 * local database and keeps it in sync; without one it sends them to /login.
 */
export function AppProvider({
  fallback,
  children,
}: Readonly<{ fallback: React.ReactNode; children: React.ReactNode }>) {
  const router = useRouter();
  // undefined while loading, null when nobody is signed in.
  const session = useLiveQuery(() => readSession(), [], undefined);
  const [services, setServices] = useState<AppServices | null>(null);

  useEffect(() => {
    if (session === null) router.replace("/login");
  }, [session, router]);

  const userId = session?.userId;
  const tenantId = session?.tenantId;

  useEffect(() => {
    if (!userId || !tenantId || !session) return;
    let cancelled = false;
    let detach: (() => void) | undefined;
    let engine: SyncEngine | undefined;

    void getDeviceId().then((deviceId) => {
      if (cancelled) return;
      const db = openLocalDb(userId);
      const store = new LocalStore(db, { tenantId, deviceId });
      engine = new SyncEngine({ db });
      detach = attachSyncTriggers(engine, store);
      // Cache every page shell now, so pages not opened yet also work offline.
      if (navigator.onLine) void warmPageCache();
      // Keep IndexedDB from being evicted (unsynced lessons live there).
      void requestPersistentStorage();
      const next = { session, db, store, engine };
      setServices(next);
      // Development only: lets browser checks and E2E tests drive the real store.
      if (process.env.NODE_ENV === "development") {
        (globalThis as typeof globalThis & { __qct?: AppServices }).__qct = next;
      }
    });

    return () => {
      cancelled = true;
      detach?.();
      engine?.dispose();
      setServices(null);
    };
    // Rebuild only when the signed-in teacher changes, not on every snapshot save.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, tenantId]);

  // The live snapshot (e.g. a renamed teacher) without rebuilding the engine.
  const value = useMemo(
    () =>
      services && session && services.session.userId === session.userId
        ? { ...services, session }
        : null,
    [services, session],
  );

  if (!value) return fallback;
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
