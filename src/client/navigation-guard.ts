import type { LocalStore } from "./db/local-store";

/**
 * Holds an in-app link click until local writes are saved. Offline, Next.js
 * can't fetch the next page's data and falls back to a full page load, which
 * aborts IndexedDB transactions still in flight: a score tapped just before
 * "back" would be lost. Waiting takes a fraction of a second at most.
 * Returns a function that removes the guard.
 */
export function attachNavigationGuard(
  store: LocalStore,
  navigate: (href: string) => void,
): () => void {
  const onClick = (event: MouseEvent) => {
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = (event.target as Element | null)?.closest?.("a[href]");
    if (!(link instanceof HTMLAnchorElement)) return;
    if (link.target && link.target !== "_self") return;
    if (link.hasAttribute("download")) return;
    const url = new URL(link.href, window.location.href);
    if (url.origin !== window.location.origin) return;
    if (!store.isBusy()) return;

    // Stop the link (and Next's own handler) until the writes are saved.
    event.preventDefault();
    event.stopPropagation();
    void store.whenIdle().then(() => navigate(url.pathname + url.search + url.hash));
  };
  document.addEventListener("click", onClick, { capture: true });
  return () => document.removeEventListener("click", onClick, { capture: true });
}
