"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { DirectionalIcon } from "@/components/directional-icon";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Content column shared by every app page. */
export function PageContainer({
  className,
  children,
}: Readonly<{ className?: string; children: React.ReactNode }>) {
  return (
    <div className={cn("mx-auto flex w-full max-w-4xl flex-col gap-4 px-4 py-4", className)}>
      {children}
    </div>
  );
}

/**
 * Page title row. `backHref` adds a back button whose arrow follows the text
 * direction. User-entered titles (class/student names) pass `userText`.
 */
export function PageHeader({
  title,
  backHref,
  actions,
  userText = false,
}: {
  title: React.ReactNode;
  backHref?: string;
  actions?: React.ReactNode;
  userText?: boolean;
}) {
  const t = useTranslations("nav");
  return (
    <div className="flex min-h-11 items-center gap-1">
      {backHref && (
        <Button asChild variant="ghost" size="icon" className="-ms-2 size-11">
          <Link href={backHref} aria-label={t("back")}>
            <DirectionalIcon icon={ArrowLeft} className="size-5" />
          </Link>
        </Button>
      )}
      <h1
        dir={userText ? "auto" : undefined}
        className="min-w-0 flex-1 truncate text-2xl font-bold"
      >
        {title}
      </h1>
      {actions}
    </div>
  );
}
