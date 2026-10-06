export type InstallMode = "installed" | "ios" | "other";

/**
 * How the app can be installed on this device:
 * - "installed": already running from the Home Screen / as an app;
 * - "ios": iPhone/iPad, where Safari has no install prompt, so we show the
 *   "Share → Add to Home Screen" steps (iPadOS reports itself as a Mac);
 * - "other": browsers that may fire `beforeinstallprompt` (Android, desktop).
 */
export function detectInstallMode(input: {
  userAgent: string;
  maxTouchPoints: number;
  standalone: boolean;
}): InstallMode {
  if (input.standalone) return "installed";
  const iPhoneOrIPad = /iPhone|iPad|iPod/.test(input.userAgent);
  const iPadAsMac = /Macintosh/.test(input.userAgent) && input.maxTouchPoints > 1;
  return iPhoneOrIPad || iPadAsMac ? "ios" : "other";
}

export function currentInstallMode(): InstallMode {
  const standalone =
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return detectInstallMode({
    userAgent: navigator.userAgent,
    maxTouchPoints: navigator.maxTouchPoints ?? 0,
    standalone,
  });
}

/**
 * Asks the browser to keep this site's storage (IndexedDB) instead of
 * evicting it under storage pressure. Safari also exempts Home Screen apps
 * from its 7-day storage cap, which is why installing is encouraged.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}
