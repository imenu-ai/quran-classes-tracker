/** Cache shared by the service worker (navigations) and the client (warm-up). */
export const PAGE_CACHE = "pages";

/** Every page shell of the signed-in app (ids come from the query string). */
export const APP_SHELL_PATHS = [
  "/",
  "/class",
  "/student",
  "/lesson",
  "/search",
  "/users",
  "/settings",
];

/** A page's cache key: origin + pathname, without the query string. */
export function pageCacheKey(url: string): string {
  const { origin, pathname } = new URL(url);
  return `${origin}${pathname}`;
}

/**
 * Fetches every page shell into the page cache right after sign-in (and
 * whenever the app starts online), so the whole app works offline after a
 * single online visit, including pages not opened yet.
 */
export async function warmPageCache(origin: string = location.origin): Promise<number> {
  if (typeof caches === "undefined" || !("serviceWorker" in navigator)) return 0;
  // Right after the first sign-in the worker may still be installing.
  await navigator.serviceWorker.ready;
  const cache = await caches.open(PAGE_CACHE);
  let cached = 0;
  await Promise.all(
    APP_SHELL_PATHS.map(async (path) => {
      try {
        const response = await fetch(path, { credentials: "same-origin" });
        if (response.ok) {
          await cache.put(pageCacheKey(`${origin}${path}`), response);
          cached += 1;
        }
      } catch {
        // Offline or a hiccup: the next start tries again.
      }
    }),
  );
  return cached;
}
