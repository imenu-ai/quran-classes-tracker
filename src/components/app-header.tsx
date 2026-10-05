import { SyncIndicator } from "./sync-indicator";

/** Top bar of the signed-in app (Phase 3 adds navigation and search). */
export function AppHeader({ title }: { title: string }) {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 pt-[env(safe-area-inset-top)] backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center justify-between gap-2 px-4 py-2">
        <span className="text-lg font-semibold">{title}</span>
        <SyncIndicator />
      </div>
    </header>
  );
}
