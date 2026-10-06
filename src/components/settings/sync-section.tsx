"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { RefreshCw, RotateCcw, Trash2 } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";
import { SyncIndicator } from "@/components/sync-indicator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useApp, useSyncStatus } from "@/client/app-context";
import { retryRejected } from "@/client/db/outbox";
import { discardRejected } from "@/client/sync/rejected";
import { useErrorMessage } from "@/i18n/use-error-message";
import type { ErrorCode } from "@/shared/schemas/errors";
import { SYNC_REJECTION_CODES } from "@/shared/sync/protocol";

/** Sync status, a manual sync, and the changes the server refused. */
export function SyncSection() {
  const t = useTranslations();
  const format = useFormatter();
  const errorMessage = useErrorMessage();
  const { db, engine } = useApp();
  const status = useSyncStatus();
  const pending = useLiveQuery(() => db.outbox.count(), [db]) ?? 0;
  const rejected = useLiveQuery(() => db.rejected.orderBy("recordId").toArray(), [db]) ?? [];
  const [discarding, setDiscarding] = useState<string | null>(null);

  const reason = (code: string, params: Record<string, string | number>) =>
    (SYNC_REJECTION_CODES as readonly string[]).includes(code)
      ? t(`syncErrors.${code as (typeof SYNC_REJECTION_CODES)[number]}`)
      : errorMessage({ code: code as ErrorCode, params });

  return (
    <section className="flex flex-col gap-3 rounded-xl border p-4">
      <h2 className="font-semibold">{t("settings.syncTitle")}</h2>
      <dl className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2 text-sm">
        <dt className="text-muted-foreground">{t("settings.status")}</dt>
        <dd>
          <SyncIndicator />
        </dd>
        <dt className="text-muted-foreground">{t("settings.pending")}</dt>
        <dd className="font-medium tabular-nums">{pending}</dd>
        <dt className="text-muted-foreground">{t("settings.lastSynced")}</dt>
        <dd className="font-medium">
          {status.lastSyncedAt
            ? format.relativeTime(status.lastSyncedAt, Date.now())
            : t("settings.never")}
        </dd>
      </dl>
      <Button
        variant="outline"
        className="h-11 self-start"
        disabled={status.state === "syncing"}
        onClick={() => void engine.syncNow()}
      >
        <RefreshCw aria-hidden />
        {t("settings.syncNow")}
      </Button>

      {rejected.length > 0 && (
        <div className="flex flex-col gap-2 rounded-lg border border-warning p-3">
          <h3 className="font-medium">{t("settings.rejectedTitle")}</h3>
          <p className="text-sm text-muted-foreground">{t("settings.rejectedHint")}</p>
          <ul className="flex flex-col divide-y">
            {rejected.map((entry) => (
              <li key={entry.recordId} className="flex flex-wrap items-center gap-2 py-2">
                <span className="min-w-0 flex-1 text-sm">
                  <span className="font-medium">{t(`tables.${entry.table}`)}</span>
                  {": "}
                  {reason(entry.code, entry.params)}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-10"
                  onClick={() =>
                    void retryRejected(db, entry.recordId, Date.now()).then(() => engine.syncNow())
                  }
                >
                  <RotateCcw aria-hidden />
                  {t("settings.retry")}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-10 text-destructive"
                  onClick={() => setDiscarding(entry.recordId)}
                >
                  <Trash2 aria-hidden />
                  {t("settings.discard")}
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <AlertDialog open={discarding !== null} onOpenChange={(open) => !open && setDiscarding(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("settings.discardConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("settings.discardConfirm")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-col">
            <AlertDialogAction
              variant="destructive"
              className="h-11"
              onClick={() => {
                if (discarding) {
                  void discardRejected(db, discarding).then(() => engine.syncNow());
                }
              }}
            >
              {t("settings.discard")}
            </AlertDialogAction>
            <AlertDialogCancel className="h-11">{t("common.cancel")}</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
