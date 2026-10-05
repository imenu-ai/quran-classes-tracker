"use client";

import { Archive, SearchX } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { EmptyState } from "@/components/empty-state";
import { PageContainer, PageHeader } from "@/components/shell/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useClass } from "@/client/data/classes";
import { ClassActionsMenu } from "./class-actions-menu";

/** A class: its students and actions (students arrive in step 3.4). */
export function ClassView({ classId }: { classId: string | null }) {
  const t = useTranslations();
  const cls = useClass(classId);

  if (cls === undefined) {
    return (
      <PageContainer aria-busy="true">
        <span className="sr-only">{t("common.loading")}</span>
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-20 w-full" />
      </PageContainer>
    );
  }

  if (cls === null || cls.deletedAt !== null) {
    return (
      <PageContainer>
        <PageHeader title={t("classes.notFound")} backHref="/" />
        <EmptyState
          icon={SearchX}
          title={t("classes.notFound")}
          action={
            <Button asChild variant="outline">
              <Link href="/">{t("common.backHome")}</Link>
            </Button>
          }
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader title={cls.name} backHref="/" userText actions={<ClassActionsMenu cls={cls} />} />
      {cls.archivedAt !== null && (
        <Badge variant="secondary" className="self-start">
          <Archive aria-hidden />
          {t("classes.archivedBadge")}
        </Badge>
      )}
    </PageContainer>
  );
}
