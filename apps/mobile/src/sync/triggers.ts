import type { SyncEngine } from "@qct/core/data/sync/engine";

export const WRITE_DEBOUNCE_MS = 1_500;
export const PERIODIC_SYNC_MS = 60_000;

interface Subscribable {
  subscribe(listener: () => void): () => void;
}

export interface TriggerSources {
  /** Whether the app is in the foreground now. */
  isActive(): boolean;
  /** Calls back when the app comes back to the foreground. */
  onActive(listener: () => void): () => void;
  /** Calls back when the connection comes or goes. */
  onConnectivity(listener: (online: boolean) => void): () => void;
}

/**
 * Starts syncing and keeps it going, like the web (apps/web
 * src/client/sync/triggers.ts):
 * - now (app start or sign-in),
 * - when the connection comes back (and shows offline when it goes),
 * - when the app returns to the foreground (iOS gives no background sync,
 *   so this is how changes go out after the teacher reopens the app),
 * - shortly after local writes (debounced),
 * - every minute while in the foreground.
 * Returns a function that removes every listener and timer.
 */
export function attachSyncTriggers(
  engine: Pick<SyncEngine, "syncNow" | "markOffline">,
  localWrites: Subscribable,
  sources: TriggerSources,
): () => void {
  const sync = () => void engine.syncNow();

  let debounce: ReturnType<typeof setTimeout> | null = null;
  const unsubscribeWrites = localWrites.subscribe(() => {
    if (debounce) clearTimeout(debounce);
    debounce = setTimeout(sync, WRITE_DEBOUNCE_MS);
  });
  const removeActive = sources.onActive(sync);
  const removeConnectivity = sources.onConnectivity((online) => {
    if (online) sync();
    else engine.markOffline();
  });
  const interval = setInterval(() => {
    if (sources.isActive()) sync();
  }, PERIODIC_SYNC_MS);

  sync();

  return () => {
    unsubscribeWrites();
    removeActive();
    removeConnectivity();
    clearInterval(interval);
    if (debounce) clearTimeout(debounce);
  };
}
