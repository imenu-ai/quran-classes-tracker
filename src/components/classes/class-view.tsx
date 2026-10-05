"use client";

import { Archive, SearchX, UserPlus, Users } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { EmptyState } from "@/components/empty-state";
import { PageContainer, PageHeader } from "@/components/shell/page";
import { ArchivedStudents, StudentList } from "@/components/students/student-list";
import { StudentFormDrawer } from "@/components/students/student-form-drawer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useClass } from "@/client/data/classes";
import { useClassStudents } from "@/client/data/students";
import { ClassActionsMenu } from "./class-actions-menu";

function LoadingView() {
  const t = useTranslations("common");
  return (
    <PageContainer aria-busy="true">
      <span className="sr-only">{t("loading")}</span>
      <Skeleton className="h-10 w-48" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-16 w-full" />
    </PageContainer>
  );
}

/** A class: its students, plus class actions. */
export function ClassView({ classId }: { classId: string | null }) {
  const t = useTranslations();
  const cls = useClass(classId);
  const students = useClassStudents(classId);
  const [adding, setAdding] = useState(false);

  if (cls === undefined || students === undefined) return <LoadingView />;

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

  const addButton = (
    <Button size="lg" className="h-11" onClick={() => setAdding(true)}>
      <UserPlus aria-hidden />
      {t("students.add")}
    </Button>
  );

  return (
    <PageContainer>
      <PageHeader title={cls.name} backHref="/" userText actions={<ClassActionsMenu cls={cls} />} />
      {cls.archivedAt !== null && (
        <Badge variant="secondary" className="self-start">
          <Archive aria-hidden />
          {t("classes.archivedBadge")}
        </Badge>
      )}

      {students.active.length === 0 ? (
        <EmptyState
          icon={Users}
          title={t("students.emptyTitle")}
          description={t("students.emptyDescription")}
          action={addButton}
        />
      ) : (
        <>
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-semibold text-muted-foreground">
              {t("classes.studentCount", { count: students.active.length })}
            </h2>
            {addButton}
          </div>
          <StudentList students={students.active} />
        </>
      )}

      <ArchivedStudents students={students.archived} />

      <StudentFormDrawer open={adding} onOpenChange={setAdding} classId={cls.id} />
    </PageContainer>
  );
}
