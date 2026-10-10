"use client";

import { Archive, SearchX } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { EmptyState } from "@/components/empty-state";
import { PageContainer, PageHeader } from "@/components/shell/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAccess } from "@/client/access";
import { useApp } from "@/client/app-context";
import { useClass } from "@/client/data/classes";
import { useStudentProfile } from "@/client/data/profile";
import { useStudent } from "@/client/data/students";
import { ageFromBirthYear, todayInTimeZone } from "@/domain/dates/local-date";
import { MonthHistory } from "./month-history";
import { MonthSummaries } from "./month-summaries";
import { MonthlyChart } from "./monthly-chart";
import { StudentActionsMenu } from "./student-actions-menu";
import { StudentToday } from "./student-today";

/** Student profile: header, current homework, monthly statistics, chart and history. */
export function StudentView({ studentId }: { studentId: string | null }) {
  const t = useTranslations();
  const { session } = useApp();
  const access = useAccess();
  const student = useStudent(studentId);
  const cls = useClass(student?.classId ?? null);
  const profile = useStudentProfile(studentId);
  const [month, setMonth] = useState<string | null>(null);
  // Default to the newest month that has data.
  const selectedMonth = month ?? profile?.months[0]?.month ?? null;

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

  const age = ageFromBirthYear(student.birthYear, todayInTimeZone(session.timezone));

  return (
    <PageContainer>
      <PageHeader
        title={student.fullName}
        backHref={`/class?id=${student.classId}`}
        userText
        actions={access.can("students.manage") ? <StudentActionsMenu student={student} /> : null}
      />

      <dl className="grid grid-cols-2 gap-3 rounded-xl border bg-card p-4 text-sm md:grid-cols-4">
        <div className="flex flex-col gap-1">
          <dt className="text-muted-foreground">{t("students.class")}</dt>
          <dd className="font-medium">
            {cls ? (
              <Link
                href={`/class?id=${cls.id}`}
                dir="auto"
                className="underline-offset-4 hover:underline"
              >
                {cls.name}
              </Link>
            ) : null}
          </dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="text-muted-foreground">{t("students.birthYear")}</dt>
          <dd className="font-medium">
            {student.birthYear} · {t("students.age", { age })}
          </dd>
        </div>
        <div className="col-span-2 flex flex-col gap-1">
          <dt className="text-muted-foreground">{t("students.direction")}</dt>
          <dd className="font-medium">{t(`students.${student.memorizationDirection}`)}</dd>
        </div>
        {student.note && (
          <div className="col-span-2 flex flex-col gap-1 md:col-span-4">
            <dt className="text-muted-foreground">{t("students.note")}</dt>
            <dd dir="auto" className="whitespace-pre-wrap">
              {student.note}
            </dd>
          </div>
        )}
      </dl>

      {student.archivedAt !== null && (
        <Badge variant="secondary" className="self-start">
          <Archive aria-hidden />
          {t("students.archivedBadge")}
        </Badge>
      )}

      {profile && (
        <>
          {access.can("reports.view") && (
            <>
              <section className="flex flex-col gap-3">
                <h2 className="text-lg font-semibold">{t("profile.monthlyTitle")}</h2>
                <MonthlyChart months={profile.months} />
                <MonthSummaries
                  months={profile.months}
                  selected={selectedMonth}
                  onSelect={setMonth}
                />
              </section>
              {selectedMonth && (
                // Without lessons.run the history is shown, not edited.
                <fieldset disabled={!access.can("lessons.run")} className="min-w-0">
                  <MonthHistory profile={profile} month={selectedMonth} student={student} />
                </fieldset>
              )}
            </>
          )}
        </>
      )}

      {/* Today: attendance, marks, postponing and the next day's homework. */}
      {student.archivedAt === null && <StudentToday student={student} />}
    </PageContainer>
  );
}
