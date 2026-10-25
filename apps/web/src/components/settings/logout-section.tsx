"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { LogOut, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { DirectionalIcon } from "@/components/directional-icon";
import { Button } from "@/components/ui/button";
import { useApp } from "@/client/app-context";
import { authClient } from "@/client/auth/auth-client";
import { deleteOwnAccount } from "@/client/data/account";
import { forgetDevice } from "@/client/session/session";
import { DeletionDialog } from "./deletion-dialog";

/**
 * Sign out, warning first when changes haven't been synced (they'd be lost),
 * and deleting one's own account (PLAN.md §0 #50).
 */
export function LogoutSection() {
  const t = useTranslations();
  const router = useRouter();
  const { session, db } = useApp();
  const pending = useLiveQuery(() => db.count("outbox"), [db]) ?? 0;
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function logout(force: boolean) {
    if (pending > 0 && !force) {
      setConfirming(true);
      return;
    }
    try {
      await authClient.signOut();
    } catch {
      // Offline: the device still forgets the session below.
    }
    await forgetDevice(db);
    router.replace("/login");
  }

  return (
    <section className="flex flex-col items-start gap-3 rounded-xl border p-4">
      <h2 className="font-semibold">{t("settings.account")}</h2>
      <p className="text-muted-foreground">
        {t.rich("settings.signedInAs", {
          name: session.name,
          user: (chunks) => <bdi className="font-medium text-foreground">{chunks}</bdi>,
        })}
      </p>
      {confirming ? (
        <div role="alert" className="flex flex-col gap-3 rounded-lg border border-warning p-3">
          <p>{t("auth.logoutPending", { count: pending })}</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="destructive" onClick={() => void logout(true)}>
              {t("auth.logoutAnyway")}
            </Button>
            <Button variant="outline" onClick={() => setConfirming(false)}>
              {t("common.cancel")}
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" onClick={() => void logout(false)}>
          <DirectionalIcon icon={LogOut} />
          {t("auth.logout")}
        </Button>
      )}
      <Button variant="outline" className="text-destructive" onClick={() => setDeleting(true)}>
        <Trash2 aria-hidden />
        {t("deletion.accountButton")}
      </Button>
      <DeletionDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={t("deletion.accountTitle")}
        description={t("deletion.accountDescription")}
        submitLabel={t("deletion.deleteAccount")}
        onDelete={deleteOwnAccount}
        onDeleted={async () => {
          // The server already ended the sessions; this forgets the device.
          await forgetDevice(db);
          toast.success(t("deletion.accountDeleted"));
          router.replace("/login");
        }}
      >
        {session.role === "admin" && (
          <p className="text-sm text-muted-foreground">{t("deletion.accountAdminHint")}</p>
        )}
        {pending > 0 && (
          <p className="text-sm text-destructive">{t("deletion.pending", { count: pending })}</p>
        )}
      </DeletionDialog>
    </section>
  );
}
