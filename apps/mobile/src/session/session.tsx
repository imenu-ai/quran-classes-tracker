import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { meResponseSchema, snapshotFromMe, type SessionSnapshot } from "@qct/core/shared/session";
import { apiFetch, authClient, clearStoredCookie } from "@/auth/client";
import { clearSession, readSession, saveSession } from "@/device/device-store";

interface SessionApi {
  /** The saved session (works offline), or null when signed out. */
  snapshot: SessionSnapshot | null;
  /**
   * After signing in (or registering, or changing the password): fetch who
   * we are from GET /api/me and remember it on the device. Needs a connection.
   */
  enter(): Promise<SessionSnapshot>;
  /** Signs out on the server when possible, and forgets the session here. */
  signOut(): Promise<void>;
}

const SessionContext = createContext<SessionApi | null>(null);

export function useSession(): SessionApi {
  const session = useContext(SessionContext);
  if (!session) throw new Error("useSession must be used inside <SessionProvider>");
  return session;
}

/** Fetches /api/me and turns it into the snapshot the device keeps. */
export async function fetchSnapshot(): Promise<SessionSnapshot> {
  const response = await apiFetch("/api/me", { headers: { accept: "application/json" } });
  if (!response.ok) throw new Error(`GET /api/me failed with ${response.status}`);
  return snapshotFromMe(meResponseSchema.parse(await response.json()), Date.now());
}

/**
 * The signed-in user, from the device: the app opens on the saved snapshot
 * without the server, like the web's offline gate (PLAN.md §2.8).
 */
export function SessionProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [snapshot, setSnapshot] = useState<SessionSnapshot | null>(() => readSession());

  const enter = useCallback(async () => {
    const next = await fetchSnapshot();
    saveSession(next);
    setSnapshot(next);
    return next;
  }, []);

  // Local data and the unsynced-changes warning arrive with sync (2.7).
  const signOut = useCallback(async () => {
    await authClient.signOut().catch(() => {});
    await clearStoredCookie();
    clearSession();
    setSnapshot(null);
  }, []);

  const value = useMemo(() => ({ snapshot, enter, signOut }), [snapshot, enter, signOut]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
