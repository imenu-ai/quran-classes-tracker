"use client";

import { SearchX } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { EmptyState } from "@/components/empty-state";
import { PageContainer, PageHeader } from "@/components/shell/page";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useClass } from "@/client/data/classes";
import { useLesson } from "@/client/data/lessons";
import { AttendanceStep } from "./attendance-step";
import { EvaluationStep } from "./evaluation-step";
import { LessonActionsMenu } from "./lesson-actions-menu";
import { useLessonDate } from "./use-lesson-date";

export type LessonStep = "attendance" | "evaluate";

/** One lesson: attendance first, then evaluation. Everything autosaves. */
export function LessonView({ lessonId, step }: { lessonId: string | null; step: LessonStep }) {
  const t = useTranslations();
  const router = useRouter();
  const formatLessonDate = useLessonDate();
  const lesson = useLesson(lessonId);
  const cls = useClass(lesson?.classId ?? null);

  if (lesson === undefined) {
    return (
      <PageContainer aria-busy="true">
        <span className="sr-only">{t("common.loading")}</span>
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-40 w-full" />
      </PageContainer>
    );
  }

  if (lesson === null || lesson.deletedAt !== null) {
    return (
      <PageContainer>
        <PageHeader title={t("lessons.notFound")} backHref="/" />
        <EmptyState
          icon={SearchX}
          title={t("lessons.notFound")}
          action={
            <Button asChild variant="outline">
              <Link href="/">{t("common.backHome")}</Link>
            </Button>
          }
        />
      </PageContainer>
    );
  }

  const setStep = (next: string) =>
    router.replace(`/lesson?id=${lesson.id}&step=${next}`, { scroll: false });

  return (
    <PageContainer>
      <PageHeader
        title={formatLessonDate(lesson.date)}
        backHref={`/class?id=${lesson.classId}`}
        actions={<LessonActionsMenu lesson={lesson} />}
      />
      {cls && (
        <p dir="auto" className="-mt-3 text-muted-foreground">
          {cls.name}
        </p>
      )}

      <Tabs value={step} onValueChange={setStep} className="gap-4">
        <TabsList aria-label={t("lessons.steps")} className="h-12 w-full">
          <TabsTrigger value="attendance" className="h-10 text-base">
            {t("lessons.stepAttendance")}
          </TabsTrigger>
          <TabsTrigger value="evaluate" className="h-10 text-base">
            {t("lessons.stepEvaluate")}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="attendance">
          <AttendanceStep lesson={lesson} onNext={() => setStep("evaluate")} />
        </TabsContent>
        <TabsContent value="evaluate">
          <EvaluationStep lesson={lesson} onBackToAttendance={() => setStep("attendance")} />
        </TabsContent>
      </Tabs>
    </PageContainer>
  );
}
