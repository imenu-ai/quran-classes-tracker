import { WifiOff } from "lucide-react";
import { getTranslations } from "next-intl/server";

/**
 * Shown by the service worker when a page is needed offline but was never
 * cached (e.g. the app was installed but not opened online yet).
 */
export default async function OfflinePage() {
  const t = await getTranslations("offline");
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center gap-4 p-6 text-center">
      <WifiOff aria-hidden className="size-12 text-muted-foreground" />
      <h1 className="text-xl font-bold">{t("title")}</h1>
      <p className="text-muted-foreground">{t("description")}</p>
    </main>
  );
}
