"use client";

import { Archive, ArrowLeft, SearchX } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { EmptyState } from "@/components/empty-state";
import { PageContainer, PageHeader } from "@/components/shell/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DirectionalIcon } from "@/components/directional-icon";
import { useAccess } from "@/client/access";
import { useApp } from "@/client/app-context";
import { isLocalDate, todayInTimeZone } from "@qct/core/domain/dates/local-date";
import { AddSession, studentDayHref } from "./add-session";
import { useStudentProfile } from "@/client/data/profile";
import { useStudent } from "@/client/data/students";
import { MonthTable } from "./month-table";
import { StudentActionsMenu } from "./student-actions-menu";
import { StudentToday } from "./student-today";

/**
 * The student's page in his class: his month as a simple table, then today
 * (attendance, marks, next day's homework). His details are in
 * the actions menu (edit student).
 */
export function StudentView({
  studentId,
  date,
}: {
  studentId: string | null;
  /** ?date=: a past day's session. Today (or a bad or future date) shows today. */
  date?: string | null;
}) {
  const t = useTranslations();
  const access = useAccess();
  const { session } = useApp();
  const student = useStudent(studentId);
  const profile = useStudentProfile(studentId);
  const today = todayInTimeZone(session.timezone);
  const day = isLocalDate(date) && date < today ? date : undefined;

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

      {student.archivedAt === null && access.can("lessons.run") && (
        <AddSession studentId={student.id} />
      )}

      {/* Today (or the picked day): attendance, marks and the next day's homework. */}
      {student.archivedAt === null && day && (
        <Button asChild variant="ghost" className="h-11 self-start">
          <Link href={studentDayHref(student.id, null)}>
            <DirectionalIcon icon={ArrowLeft} />
            {t("day.backToToday")}
          </Link>
        </Button>
      )}
      {student.archivedAt === null && (
        <StudentToday key={day ?? "today"} student={student} date={day} />
      )}
    </PageContainer>
  );
}
