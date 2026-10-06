/// <reference lib="webworker" />
import { defaultCache } from "@serwist/next/worker";
import {
  CacheableResponsePlugin,
  NetworkFirst,
  NetworkOnly,
  Serwist,
  type PrecacheEntry,
  type SerwistGlobalConfig,
  type SerwistPlugin,
} from "serwist";
import { PAGE_CACHE, pageCacheKey } from "@/client/pwa/page-cache";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

/**
 * Page shells are cached by PATH only: the app's routes take their ids from
 * the query (/student?id=…), so one cached /student shell serves every
 * student offline after a single online visit.
 */
const byPathname: SerwistPlugin = {
  cacheKeyWillBeUsed: async ({ request }) => pageCacheKey(request.url),
};

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    // Data always goes through the sync engine; never cache the API.
    {
      matcher: ({ url, sameOrigin }) => sameOrigin && url.pathname.startsWith("/api/"),
      handler: new NetworkOnly(),
    },
    // React Server Component payloads: fail fast offline. Next.js then falls
    // back to a full page load, which is served from the page-shell cache.
    {
      matcher: ({ request }) => request.headers.get("RSC") === "1",
      handler: new NetworkOnly(),
    },
    // Page shells: network first (fresh when online), cache after 3 s or offline.
    {
      matcher: ({ request, sameOrigin }) => sameOrigin && request.mode === "navigate",
      handler: new NetworkFirst({
        cacheName: PAGE_CACHE,
        networkTimeoutSeconds: 3,
        matchOptions: { ignoreVary: true },
        plugins: [byPathname, new CacheableResponsePlugin({ statuses: [200] })],
      }),
    },
    ...defaultCache,
  ],
  fallbacks: {
    entries: [
      {
        url: "/~offline",
        matcher: ({ request }) => request.destination === "document",
      },
    ],
  },
});

serwist.addEventListeners();
