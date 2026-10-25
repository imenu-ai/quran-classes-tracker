import { useTranslations } from "next-intl";
import Link from "next/link";
import { PRIVACY_PATH, SUPPORT_PATH } from "@qct/core/shared/legal";
import { cn } from "@/lib/utils";

/** The privacy policy and support pages, under sign-in, registration and Settings. */
export function LegalLinks({ className }: Readonly<{ className?: string }>) {
  const t = useTranslations("legal");
  return (
    <nav className={cn("flex flex-wrap justify-center gap-x-4 gap-y-2 text-sm", className)}>
      <Link href={PRIVACY_PATH} className="text-muted-foreground underline">
        {t("privacy")}
      </Link>
      <Link href={SUPPORT_PATH} className="text-muted-foreground underline">
        {t("support")}
      </Link>
    </nav>
  );
}
