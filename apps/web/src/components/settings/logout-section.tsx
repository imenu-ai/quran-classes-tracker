"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { DirectionalIcon } from "@/components/directional-icon";
import { Button } from "@/components/ui/button";
import { useApp } from "@/client/app-context";
import { authClient } from "@/client/auth/auth-client";
import { forgetDevice } from "@/client/session/session";

/** Sign out, warning first when changes haven't been synced (they'd be lost). */
export function LogoutSection() {
  const t = useTranslations();
  const router = useRouter();
  const { session, db } = useApp();
  const pending = useLiveQuery(() => db.outbox.count(), [db]) ?? 0;
  const [confirming, setConfirming] = useState(false);

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
    </section>
  );
}
