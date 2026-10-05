"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { authClient } from "@/client/auth/auth-client";

/**
 * Temporary home (Phase 1). Phase 2 replaces the session check with the
 * offline user snapshot stored in IndexedDB.
 */
export function HomePlaceholder() {
  const t = useTranslations();
  const router = useRouter();
  const { data, isPending } = authClient.useSession();

  useEffect(() => {
    if (!isPending && !data) router.replace("/login");
  }, [isPending, data, router]);

  async function logout() {
    await authClient.signOut();
    router.replace("/login");
  }

  if (!data) {
    return (
      <div className="flex flex-col gap-3" aria-busy="true">
        <span className="sr-only">{t("common.loading")}</span>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-32" />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start gap-4">
      <p className="text-xl" dir="auto">
        {t("home.greeting", { name: data.user.name })}
      </p>
      <Button variant="outline" onClick={logout}>
        <LogOut aria-hidden />
        {t("auth.logout")}
      </Button>
    </div>
  );
}
