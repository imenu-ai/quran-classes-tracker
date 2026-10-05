import type { SyncEngine } from "./engine";

export const WRITE_DEBOUNCE_MS = 1_500;
export const PERIODIC_SYNC_MS = 60_000;

interface Subscribable {
  subscribe(listener: () => void): () => void;
}

/**
 * Starts syncing and keeps it going:
 * - now (app start),
 * - when the browser comes back online,
 * - when the app becomes visible again (iOS has no background sync, so this
 *   is how changes go out after the teacher reopens the app),
 * - shortly after local writes (debounced),
 * - every minute while visible.
 * Returns a function that removes every listener and timer.
 */
export function attachSyncTriggers(
  engine: SyncEngine,
  localWrites: Subscribable,
  target: { window: Window; document: Document } = { window, document },
): () => void {
  const { window: win, document: doc } = target;
  const sync = () => void engine.syncNow();
  const visible = () => doc.visibilityState === "visible";

  let debounce: ReturnType<typeof setTimeout> | null = null;
  const onWrite = () => {
    if (debounce) clearTimeout(debounce);
    debounce = setTimeout(sync, WRITE_DEBOUNCE_MS);
  };
  const onOffline = () => engine.markOffline();
  const onVisibility = () => {
    if (visible()) sync();
  };

  win.addEventListener("online", sync);
  win.addEventListener("offline", onOffline);
  doc.addEventListener("visibilitychange", onVisibility);
  const unsubscribeWrites = localWrites.subscribe(onWrite);
  const interval = setInterval(() => {
    if (visible()) sync();
  }, PERIODIC_SYNC_MS);

  sync();

  return () => {
    win.removeEventListener("online", sync);
    win.removeEventListener("offline", onOffline);
    doc.removeEventListener("visibilitychange", onVisibility);
    unsubscribeWrites();
    clearInterval(interval);
    if (debounce) clearTimeout(debounce);
  };
}
