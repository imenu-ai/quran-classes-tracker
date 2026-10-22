"use client";

import { Archive, SearchX } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { EmptyState } from "@/components/empty-state";
import { PageContainer, PageHeader } from "@/components/shell/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAccess } from "@/client/access";
import { useStudentProfile } from "@/client/data/profile";
import { useStudent } from "@/client/data/students";
import { MonthTable } from "./month-table";
import { StudentActionsMenu } from "./student-actions-menu";
import { StudentToday } from "./student-today";

/**
 * The student's page in his class: his month as a simple table, then today
 * (attendance, marks, postponing, next day's homework). His details are in
 * the actions menu (edit student).
 */
export function StudentView({ studentId }: { studentId: string | null }) {
  const t = useTranslations();
  const access = useAccess();
  const student = useStudent(studentId);
  const profile = useStudentProfile(studentId);

  if (student === undefined) {
    return (
      <PageContainer aria-busy="true">
        <span className="sr-only">{t("common.loading")}</span>
        <Skeleton className="h-10 w-56" />
        <Skeleton className="h-28 w-full" />
      </PageContainer>
    );
  }

  if (student === null || student.deletedAt !== null) {
    return (
      <PageContainer>
        <PageHeader title={t("students.notFound")} backHref="/" />
        <EmptyState
          icon={SearchX}
          title={t("students.notFound")}
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
      <PageHeader
        title={student.fullName}
        backHref={`/class?id=${student.classId}`}
        userText
        actions={access.can("students.manage") ? <StudentActionsMenu student={student} /> : null}
      />

      {student.archivedAt !== null && (
        <Badge variant="secondary" className="self-start">
          <Archive aria-hidden />
          {t("students.archivedBadge")}
        </Badge>
      )}

      {profile && access.can("reports.view") && (
        // Without lessons.run the table is shown, not edited.
        <MonthTable profile={profile} student={student} editable={access.can("lessons.run")} />
      )}

      {/* Today: attendance, marks, postponing and the next day's homework. */}
      {student.archivedAt === null && <StudentToday student={student} />}
    </PageContainer>
  );
}
