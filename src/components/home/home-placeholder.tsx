"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useApp } from "@/client/app-context";
import { authClient } from "@/client/auth/auth-client";
import { forgetDevice } from "@/client/session/session";

/**
 * Temporary home (Phases 1–2): shows what's stored on this device and lets
 * the teacher sign out. Phase 3 replaces it with the class list.
 */
export function HomePlaceholder() {
  const t = useTranslations();
  const router = useRouter();
  const { session, db } = useApp();
  const classes = useLiveQuery(() => db.classes.filter((c) => c.deletedAt === null).count(), [db]);
  const students = useLiveQuery(
    () => db.students.filter((s) => s.deletedAt === null).count(),
    [db],
  );
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
    <div className="flex flex-col items-start gap-4">
      <p className="text-xl" dir="auto">
        {t("home.greeting", { name: session.name })}
      </p>
      <p className="text-muted-foreground">
        {t("home.localData", { classes: classes ?? 0, students: students ?? 0 })}
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
          <LogOut aria-hidden />
          {t("auth.logout")}
        </Button>
      )}
    </div>
  );
}
