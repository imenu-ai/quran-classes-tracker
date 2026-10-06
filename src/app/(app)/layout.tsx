import { getTranslations } from "next-intl/server";
import { AppProvider } from "@/client/app-context";
import { AppShell } from "@/components/shell/app-shell";
import { Skeleton } from "@/components/ui/skeleton";

/** Everything behind sign-in. The gate runs on the device (works offline). */
export default async function AppLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const t = await getTranslations("common");
  const fallback = (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4 p-4" aria-busy="true">
      <span className="sr-only">{t("loading")}</span>
      <Skeleton className="h-8 w-56" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-24 w-full" />
    </div>
  );
  return (
    <AppProvider fallback={fallback}>
      <AppShell>{children}</AppShell>
    </AppProvider>
  );
}
