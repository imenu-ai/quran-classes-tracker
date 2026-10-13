import { getTranslations } from "next-intl/server";
import { AppProvider } from "@/client/app-context";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Printable pages: behind the same sign-in gate and local data as the app,
 * but without its navigation (it would end up on paper).
 */
export default async function PrintLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const t = await getTranslations("common");
  const fallback = (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4 p-4" aria-busy="true">
      <span className="sr-only">{t("loading")}</span>
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-96 w-full" />
    </div>
  );
  return <AppProvider fallback={fallback}>{children}</AppProvider>;
}
