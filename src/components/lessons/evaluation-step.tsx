"use client";

import { ChevronDown, UserCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useLessonEvaluation } from "@/client/data/homework";
import { cn } from "@/lib/utils";
import type { LessonRecord } from "@/shared/schemas/lesson";
import { StudentEvaluationCard } from "./student-evaluation-card";

/** Step 2 of a lesson: evaluate homework and assign the next. Autosaves. */
export function EvaluationStep({
  lesson,
  onBackToAttendance,
}: {
  lesson: LessonRecord;
  onBackToAttendance: () => void;
}) {
  const t = useTranslations();
  const evaluation = useLessonEvaluation(lesson);
  const [showUnmarked, setShowUnmarked] = useState(false);

  if (evaluation === undefined) {
    return (
      <div className="flex flex-col gap-3" aria-busy="true">
        <span className="sr-only">{t("common.loading")}</span>
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  const { present, unmarked, progress } = evaluation;
  const percent = progress.total ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <div className="flex flex-col gap-4">
      {progress.total > 0 && (
        <div className="flex flex-col gap-2">
          <p className="font-medium" aria-live="polite">
            {t("evaluation.progress", progress)}
          </p>
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={progress.total}
            aria-valuenow={progress.done}
            aria-label={t("evaluation.progress", progress)}
            className="h-2 overflow-hidden rounded-full bg-muted"
          >
            <div
              className="h-full rounded-full bg-success transition-all"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
      )}

      {present.length === 0 ? (
        <EmptyState
          icon={UserCheck}
          title={t("evaluation.noPresent")}
          action={
            <Button variant="outline" className="h-11" onClick={onBackToAttendance}>
              {t("evaluation.goToAttendance")}
            </Button>
          }
        />
      ) : (
        <div className="grid items-start gap-3 lg:grid-cols-2">
          {present.map((entry) => (
            <StudentEvaluationCard key={entry.student.id} entry={entry} lessonId={lesson.id} />
          ))}
        </div>
      )}

      {unmarked.length > 0 && (
        <section className="flex flex-col gap-2">
          <Button
            variant="ghost"
            className="h-11 justify-between px-2 text-muted-foreground"
            aria-expanded={showUnmarked}
            onClick={() => setShowUnmarked((value) => !value)}
          >
            <span>
              {t("evaluation.unmarkedTitle")} ({unmarked.length})
            </span>
            <ChevronDown
              aria-hidden
              className={cn("transition-transform", showUnmarked && "rotate-180")}
            />
          </Button>
          {showUnmarked && (
            <>
              <p className="px-2 text-sm text-muted-foreground">{t("evaluation.unmarkedHint")}</p>
              <div className="grid items-start gap-3 lg:grid-cols-2">
                {unmarked.map((entry) => (
                  <StudentEvaluationCard
                    key={entry.student.id}
                    entry={entry}
                    lessonId={lesson.id}
                  />
                ))}
              </div>
            </>
          )}
        </section>
      )}
    </div>
  );
}
