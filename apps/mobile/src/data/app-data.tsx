import {
  createContext,
  useContext,
  useEffect,
  useEffectEvent,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { LocalDatabase } from "@qct/core/data/database";
import { LocalStore } from "@qct/core/data/local-store";
import { createSqlStorage } from "@qct/core/data/sql-storage";
import { SyncEngine, type SyncStatus } from "@qct/core/data/sync/engine";
import type { SessionSnapshot } from "@qct/core/shared/session";
import { sessionFetch } from "@/auth/client";
import { API_URL } from "@/config";
import { getDeviceId } from "@/device/device-store";
import { useSession } from "@/session/session";
import { deviceIsOnline, deviceTriggerSources } from "@/sync/device";
import { attachSyncTriggers } from "@/sync/triggers";
import { openUserDatabaseFile } from "./expo-sqlite-driver";

export interface AppServices {
  session: SessionSnapshot;
  db: LocalDatabase;
  store: LocalStore;
  engine: SyncEngine;
  /**
   * Signs out and deletes this user's local data. Callers warn first when
   * changes are still unsynced (they'd be lost).
   */
  signOut(): Promise<void>;
}

const AppContext = createContext<AppServices | null>(null);

/** The signed-in user's local database, store and sync engine. */
export function useApp(): AppServices {
  const services = useContext(AppContext);
  if (!services) throw new Error("useApp must be used inside <AppDataProvider> once it's ready");
  return services;
}

/** Hands screens ready-made services, without a database file (tests). */
export const AppServicesProvider = AppContext.Provider;

/** Whether the signed-in user's services are ready (their database opens at start). */
export const useAppReady = () => useContext(AppContext) !== null;

export function useSyncStatus(): SyncStatus {
  const { engine } = useApp();
  return useSyncExternalStore(
    (onChange) => engine.subscribe(onChange),
    () => engine.getStatus(),
  );
}

/**
 * Opens the signed-in user's database and keeps it in sync, like the web's
 * AppProvider. Nothing syncs while an admin-set password waits to be
 * replaced (the server would refuse anyway).
 */
export function AppDataProvider({ children }: Readonly<{ children: ReactNode }>) {
  const { snapshot, enter, signOut } = useSession();
  const [services, setServices] = useState<Omit<AppServices, "session"> | null>(null);

  const userId = snapshot?.userId;
  const tenantId = snapshot?.tenantId;
  const active = snapshot !== null && !snapshot.mustChangePassword;
  // The engine lives as long as the user; these read the latest session.
  const getAccessVersion = useEffectEvent(() => snapshot?.accessVersion);
  const refreshSession = useEffectEvent(() => enter());
  const endSession = useEffectEvent((wipe: () => Promise<void>) => signOut(wipe));

  useEffect(() => {
    if (!userId || !tenantId || !active) return;
    let cancelled = false;
    let teardown: (() => Promise<void>) | undefined;

    const open = async () => {
      const file = await openUserDatabaseFile(userId);
      const storage = await createSqlStorage(file.driver);
      if (cancelled) {
        await file.close();
        return;
      }
      const db = new LocalDatabase(storage);
      const store = new LocalStore(db, { tenantId, deviceId: getDeviceId() });
      const engine = new SyncEngine({
        db,
        apiBaseUrl: API_URL,
        fetch: (input, init) => sessionFetch(String(input), init),
        isOnline: deviceIsOnline,
        getAccessVersion: () => getAccessVersion(),
        // New classes or permissions: the engine rebuilt the local copy;
        // refresh the saved session so screens show the new access.
        onAccessChanged: async () => {
          await refreshSession();
        },
        // The refreshed session then says so, and the gate shows the change.
        onPasswordChangeRequired: () => {
          void refreshSession().catch(() => {});
        },
      });
      const detachTriggers = attachSyncTriggers(engine, store, deviceTriggerSources);
      teardown = async () => {
        detachTriggers();
        engine.dispose();
        await file.close();
      };
      setServices({
        db,
        store,
        engine,
        signOut: async () => {
          detachTriggers();
          engine.dispose();
          await endSession(() => db.destroy());
        },
      });
    };
    // Without its database the app can't show anything; let it surface.
    open().catch((error: unknown) => {
      console.error("Couldn't open the local database", error);
    });

    return () => {
      cancelled = true;
      setServices(null);
      void teardown?.().catch(() => {});
    };
  }, [userId, tenantId, active]);

  // The live snapshot (e.g. a renamed teacher) without rebuilding the engine.
  const value = useMemo(
    () => (services && snapshot && active ? { ...services, session: snapshot } : null),
    [services, snapshot, active],
  );
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
