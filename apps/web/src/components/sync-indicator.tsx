"use client";

import { useLiveQuery } from "dexie-react-hooks";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useApp, useSyncStatus } from "@/client/app-context";
import { getIndicator, type IndicatorTone } from "@/client/sync/indicator";
import { cn } from "@/lib/utils";

const DOT: Record<IndicatorTone, string> = {
  ok: "bg-success",
  busy: "bg-primary motion-safe:animate-pulse",
  muted: "bg-muted-foreground",
  warning: "bg-warning",
  danger: "bg-destructive",
};

const PILL =
  "inline-flex min-h-9 max-w-full items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium";

/**
 * Always-visible sync state: online / offline / "X changes waiting to sync".
 * Tapping it syncs now; when the session expired it links to sign-in.
 */
export function SyncIndicator({ className }: { className?: string }) {
  const t = useTranslations("sync");
  const { db, engine } = useApp();
  const status = useSyncStatus();
  const pending = useLiveQuery(() => db.outbox.count(), [db]) ?? 0;
  const rejected = useLiveQuery(() => db.rejected.count(), [db]) ?? 0;

  const indicator = getIndicator({ state: status.state, pending, rejected });
  const text = indicator.messages
    .map((message) =>
      "count" in message ? t(message.key, { count: message.count }) : t(message.key),
    )
    .join(" · ");
  const dot = (
    <span aria-hidden className={cn("size-2 shrink-0 rounded-full", DOT[indicator.tone])} />
  );

  return (
    <div role="status" aria-live="polite" className={cn("min-w-0", className)}>
      {status.state === "needsLogin" ? (
        <Link
          href="/login"
          className={cn(PILL, "border-destructive/40 text-destructive hover:bg-destructive/10")}
          aria-label={`${text}. ${t("signInAgain")}`}
        >
          {dot}
          <span className="truncate">{text}</span>
        </Link>
      ) : (
        <button
          type="button"
          onClick={() => void engine.syncNow()}
          className={cn(PILL, "bg-background hover:bg-accent")}
          aria-label={`${text}. ${t("syncNow")}`}
        >
          {dot}
          <span className="truncate">{text}</span>
        </button>
      )}
    </div>
  );
}
